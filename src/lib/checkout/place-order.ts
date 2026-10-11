/**
 * Order placement. Everything happens in one database transaction:
 *   validate cart → price on the server → check discount → reserve stock
 *   → create order, items, payment record and history → clear the cart.
 *
 * Overselling is prevented with a conditional update
 *   UPDATE "ProductVariant" SET stock = stock - qty WHERE id = ? AND stock >= qty
 * PostgreSQL row locks serialize concurrent buyers, so when two customers race
 * for the last item exactly one succeeds. (tests/integration/checkout.test.ts)
 *
 * This module has no Next.js imports so it can be tested against a real database.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { generateToken, sha256 } from "../auth/crypto";
import { computeTotals } from "../cart/totals";
import { effectiveVariantPrice } from "../catalog/pricing";
import { syncProductDerived } from "../catalog/sync";
import { checkDiscount, normalizeDiscountCode, discountErrorMessage, type DiscountRule } from "../discounts/evaluate";
import type { FulfillmentMethod } from "../domain";
import { formatMoney, type CurrencyConfig } from "../money";
import { canEnable, initialPaymentStatus, isMethodAvailable, paymentDetailsForCustomer } from "../payments/rules";
import { registeredProviderKeys } from "../payments/providers";
import { validatePersonalization, type PersonalizationValue } from "../personalization";
import { getAllSettings } from "../settings";

export class CheckoutError extends Error {
  constructor(
    message: string,
    public readonly code: "CART" | "STOCK" | "DISCOUNT" | "PAYMENT" | "DELIVERY" | "PRICE_CHANGED" | "VALIDATION" = "VALIDATION",
  ) {
    super(message);
    this.name = "CheckoutError";
  }
}

export type CheckoutAddress = {
  recipientName: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  region?: string | null;
  instructions?: string | null;
  zoneId: string;
};

export type PlaceOrderInput = {
  cartId: string;
  userId: string | null;
  email: string;
  name: string;
  phone: string;
  fulfillment: FulfillmentMethod;
  address: CheckoutAddress | null;
  paymentMethodId: string;
  customerNote?: string | null;
  acceptTerms: boolean;
  /** Total the customer reviewed. If the server total differs, the order is not placed. */
  expectedTotal: number | null;
  saveAddress?: boolean;
};

export type PlaceOrderResult = {
  orderId: string;
  number: string;
  /** Present for every order; needed by guests to view their order. */
  accessToken: string;
  total: number;
};

const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 20_000 } as const;

export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const settings = await getAllSettings();
  const { commerce, pickup } = settings;
  const currency: CurrencyConfig = { code: commerce.currencyCode, decimals: commerce.currencyDecimals, locale: commerce.currencyLocale };
  const fmt = (minor: number) => formatMoney(minor, currency);
  const now = new Date();

  if (commerce.requireTermsAcceptance && !input.acceptTerms) {
    throw new CheckoutError("Please accept the terms and policies to place your order.");
  }
  if (!input.userId && !commerce.allowGuestCheckout) {
    throw new CheckoutError("Please sign in or create an account to place an order.");
  }

  const accessToken = generateToken();

  const result = await prisma.$transaction(async (tx) => {
    // ── Cart ────────────────────────────────────────────────
    const cart = await tx.cart.findUnique({
      where: { id: input.cartId },
      include: {
        items: {
          orderBy: { createdAt: "asc" },
          include: {
            variant: {
              include: {
                product: {
                  include: {
                    personalizationFields: true,
                    images: { orderBy: { position: "asc" }, take: 1, select: { asset: { select: { key: true } } } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!cart || cart.items.length === 0) throw new CheckoutError("Your cart is empty.", "CART");
    if (input.userId && cart.userId !== input.userId) throw new CheckoutError("Your cart could not be found.", "CART");

    // ── Lines, priced on the server ─────────────────────────
    const lines = cart.items.map((item) => {
      const { variant } = item;
      const product = variant.product;
      if (product.status !== "ACTIVE" || !variant.isActive) {
        throw new CheckoutError(`"${product.name}" is no longer available. Remove it from your cart to continue.`, "CART");
      }
      if (product.pricingType !== "FIXED") {
        throw new CheckoutError(`"${product.name}" is made to quote and can't be checked out.`, "CART");
      }
      const stored = (Array.isArray(item.personalization) ? item.personalization : []) as PersonalizationValue[];
      const submitted = Object.fromEntries(stored.map((value) => [value.fieldId, value.value]));
      const personalization = validatePersonalization(product.personalizationFields, submitted);
      if (!personalization.ok) {
        throw new CheckoutError(`Check the personalization for "${product.name}" — remove it and add it again.`, "CART");
      }
      const caps = [product.maxPerOrder, commerce.maxQuantityPerLine].filter((n): n is number => typeof n === "number");
      if (caps.length && item.quantity > Math.min(...caps)) {
        throw new CheckoutError(`You can order at most ${Math.min(...caps)} of "${product.name}".`, "CART");
      }
      const price = effectiveVariantPrice(variant, product, now);
      return {
        item,
        product,
        variant,
        quantity: item.quantity,
        unitPrice: price.price,
        personalizationPrice: personalization.surcharge,
        personalization: personalization.values,
      };
    });

    const subtotal = lines.reduce((sum, line) => sum + (line.unitPrice + line.personalizationPrice) * line.quantity, 0);
    if (commerce.minOrderSubtotal > 0 && subtotal < commerce.minOrderSubtotal) {
      throw new CheckoutError(`The minimum order is ${fmt(commerce.minOrderSubtotal)}.`, "CART");
    }

    // ── Fulfillment ─────────────────────────────────────────
    let delivery: { fee: number; freeAboveSubtotal: number | null } | null = null;
    let zone: { id: string; name: string } | null = null;
    if (input.fulfillment === "DELIVERY") {
      if (!input.address) throw new CheckoutError("Enter a delivery address.", "DELIVERY");
      const found = await tx.deliveryZone.findFirst({ where: { id: input.address.zoneId, isActive: true } });
      if (!found) throw new CheckoutError("We don't deliver to the selected area yet. Choose another area or pickup.", "DELIVERY");
      zone = { id: found.id, name: found.name };
      delivery = { fee: found.fee, freeAboveSubtotal: found.freeAboveSubtotal };
    } else if (!pickup.enabled) {
      throw new CheckoutError("Pickup isn't available right now. Choose delivery instead.", "DELIVERY");
    }

    // ── Discount ────────────────────────────────────────────
    let discountRule: DiscountRule | null = null;
    let discountRecord: { id: string; code: string; usageLimit: number | null } | null = null;
    if (cart.discountCode) {
      const code = normalizeDiscountCode(cart.discountCode);
      const discount = await tx.discount.findUnique({ where: { code } });
      const customerRedemptions = discount
        ? await tx.discountRedemption.count({
            where: {
              discountId: discount.id,
              OR: [{ email: input.email.toLowerCase() }, ...(input.userId ? [{ userId: input.userId }] : [])],
            },
          })
        : 0;
      const check = checkDiscount(discount, { subtotal, now, customerRedemptions });
      if (!check.ok) throw new CheckoutError(`Discount code ${code}: ${discountErrorMessage(check, fmt)} Remove it to continue.`, "DISCOUNT");
      discountRule = check.rule;
      discountRecord = { id: discount!.id, code, usageLimit: discount!.usageLimit };
    }

    // ── Totals ──────────────────────────────────────────────
    const totals = computeTotals({
      lines: lines.map((line) => ({ unitPrice: line.unitPrice, personalizationPrice: line.personalizationPrice, quantity: line.quantity })),
      discount: discountRule,
      delivery,
      tax: { enabled: commerce.taxEnabled, rateBps: commerce.taxRateBps, included: commerce.taxIncluded },
    });
    if (input.expectedTotal !== null && input.expectedTotal !== totals.total) {
      throw new CheckoutError(
        `Your order total changed to ${fmt(totals.total)} (for example, a price or delivery fee was updated). Please review it and place the order again.`,
        "PRICE_CHANGED",
      );
    }

    // ── Payment method ──────────────────────────────────────
    const method = await tx.paymentMethod.findUnique({ where: { id: input.paymentMethodId } });
    // Re-checks the method's required details too, so a method whose details
    // were removed (or whose gateway is no longer installed) is never used.
    if (
      !method ||
      !isMethodAvailable(method, { fulfillment: input.fulfillment, total: totals.total }) ||
      !canEnable({ ...method, config: (method.config ?? {}) as Record<string, unknown> }, registeredProviderKeys())
    ) {
      throw new CheckoutError("The selected payment method isn't available for this order. Choose another one.", "PAYMENT");
    }

    // ── Discount usage (atomic against the usage limit) ─────
    if (discountRecord) {
      const updated = await tx.$executeRaw`
        UPDATE "Discount" SET "usageCount" = "usageCount" + 1, "updatedAt" = (NOW() AT TIME ZONE 'UTC')
        WHERE "id" = ${discountRecord.id} AND ("usageLimit" IS NULL OR "usageCount" < "usageLimit")`;
      if (updated === 0) throw new CheckoutError(`Discount code ${discountRecord.code} has reached its usage limit. Remove it to continue.`, "DISCOUNT");
    }

    // ── Stock reservation (prevents overselling) ────────────
    const stockResults = new Map<string, { isBackorder: boolean; stockAfter: number | null }>();
    const quantityByVariant = new Map<string, { quantity: number; line: (typeof lines)[number] }>();
    for (const line of lines) {
      const entry = quantityByVariant.get(line.variant.id);
      quantityByVariant.set(line.variant.id, { quantity: (entry?.quantity ?? 0) + line.quantity, line });
    }
    for (const [variantId, { quantity, line }] of quantityByVariant) {
      if (!line.product.trackInventory) {
        stockResults.set(variantId, { isBackorder: false, stockAfter: null });
        continue;
      }
      if (line.product.allowBackorder) {
        const updated = await tx.productVariant.update({
          where: { id: variantId },
          data: { stock: { decrement: quantity } },
          select: { stock: true },
        });
        stockResults.set(variantId, { isBackorder: updated.stock < 0, stockAfter: updated.stock });
      } else {
        const updated = await tx.productVariant.updateMany({
          where: { id: variantId, stock: { gte: quantity } },
          data: { stock: { decrement: quantity } },
        });
        if (updated.count === 0) {
          const current = await tx.productVariant.findUnique({ where: { id: variantId }, select: { stock: true } });
          const left = Math.max(0, current?.stock ?? 0);
          throw new CheckoutError(
            left > 0
              ? `Only ${left} of "${line.product.name}" ${left === 1 ? "is" : "are"} left. Update the quantity in your cart.`
              : `"${line.product.name}" just sold out. Remove it from your cart to continue.`,
            "STOCK",
          );
        }
        const after = await tx.productVariant.findUnique({ where: { id: variantId }, select: { stock: true } });
        stockResults.set(variantId, { isBackorder: false, stockAfter: after?.stock ?? null });
      }
    }

    // ── Order number ────────────────────────────────────────
    const seqRows = await tx.$queryRaw<{ nextval: bigint }[]>`SELECT nextval(pg_get_serial_sequence('"Order"', 'orderSeq'))`;
    const orderSeq = Number(seqRows[0].nextval);
    const number = `SG-${10000 + orderSeq}`;

    const paymentStatus = initialPaymentStatus(method.type);
    const config = (method.config ?? {}) as Record<string, unknown>;
    const details = paymentDetailsForCustomer({ ...method, config });
    const instructionsSnapshot = [method.instructions?.trim(), ...details.map((d) => `${d.label}: ${d.value}`)]
      .filter(Boolean)
      .join("\n");
    const prepTimeMaxDays = lines.reduce<number | null>((max, line) => {
      const days = line.product.prepTimeMaxDays;
      return days === null ? max : Math.max(max ?? 0, days);
    }, null);

    const address = input.fulfillment === "DELIVERY" ? input.address : null;

    const order = await tx.order.create({
      data: {
        orderSeq,
        number,
        userId: input.userId,
        email: input.email.toLowerCase(),
        customerName: input.name,
        phone: input.phone,
        status: "PENDING",
        paymentStatus,
        fulfillmentMethod: input.fulfillment,
        shipRecipient: address?.recipientName ?? null,
        shipPhone: address?.phone ?? null,
        shipLine1: address?.line1 ?? null,
        shipLine2: address?.line2 ?? null,
        shipCity: address?.city ?? null,
        shipRegion: address?.region ?? null,
        shipInstructions: address?.instructions ?? null,
        deliveryZoneId: zone?.id ?? null,
        deliveryZoneName: zone?.name ?? null,
        currency: currency.code,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        deliveryFee: totals.deliveryFee,
        taxTotal: totals.taxTotal,
        taxIncluded: totals.taxIncluded,
        total: totals.total,
        discountId: discountRecord?.id ?? null,
        discountCode: discountRecord?.code ?? null,
        paymentMethodId: method.id,
        paymentMethodName: method.name,
        paymentMethodType: method.type,
        paymentInstructions: instructionsSnapshot || null,
        customerNote: input.customerNote?.trim() || null,
        accessTokenHash: sha256(accessToken),
        prepTimeMaxDays,
        items: {
          create: lines.map((line) => ({
            productId: line.product.id,
            variantId: line.variant.id,
            productName: line.product.name,
            variantTitle: line.variant.title === "Default" ? null : line.variant.title,
            sku: line.variant.sku,
            unitPrice: line.unitPrice,
            personalizationPrice: line.personalizationPrice,
            quantity: line.quantity,
            lineTotal: (line.unitPrice + line.personalizationPrice) * line.quantity,
            costPrice: line.variant.costPrice,
            personalization: line.personalization.length
              ? (line.personalization.map((p) => ({ label: p.label, value: p.value })) as Prisma.InputJsonValue)
              : undefined,
            imageKey: line.product.images[0]?.asset.key ?? null,
            madeToOrder: line.product.madeToOrder,
            prepTimeMaxDays: line.product.prepTimeMaxDays,
            isBackorder: stockResults.get(line.variant.id)?.isBackorder ?? false,
          })),
        },
        payments: {
          create: {
            paymentMethodId: method.id,
            methodType: method.type,
            methodName: method.name,
            kind: "CHARGE",
            amount: totals.total,
            currency: currency.code,
            status: "PENDING",
          },
        },
        events: {
          create: {
            type: "CREATED",
            message: `Order placed — ${method.name}, ${input.fulfillment === "DELIVERY" ? "delivery" : "pickup"}.`,
            isInternal: false,
            actorId: input.userId,
            actorName: input.name,
          },
        },
      },
      select: { id: true, number: true, total: true },
    });

    // Inventory movements for the audit trail
    for (const [variantId, { quantity, line }] of quantityByVariant) {
      if (!line.product.trackInventory) continue;
      await tx.inventoryMovement.create({
        data: {
          variantId,
          delta: -quantity,
          stockAfter: stockResults.get(variantId)?.stockAfter ?? null,
          reason: "ORDER_PLACED",
          orderId: order.id,
        },
      });
    }

    if (discountRecord) {
      await tx.discountRedemption.create({
        data: {
          discountId: discountRecord.id,
          orderId: order.id,
          userId: input.userId,
          email: input.email.toLowerCase(),
          amount: totals.discountTotal,
        },
      });
    }

    // Popularity and stock flags
    const productQuantities = new Map<string, number>();
    for (const line of lines) productQuantities.set(line.product.id, (productQuantities.get(line.product.id) ?? 0) + line.quantity);
    for (const [productId, quantity] of productQuantities) {
      await tx.product.update({ where: { id: productId }, data: { salesCount: { increment: quantity } } });
    }
    for (const productId of productQuantities.keys()) await syncProductDerived(productId, tx, commerce.lowStockThreshold);

    if (input.saveAddress && input.userId && address) {
      const count = await tx.address.count({ where: { userId: input.userId } });
      await tx.address.create({
        data: {
          userId: input.userId,
          recipientName: address.recipientName,
          phone: address.phone,
          line1: address.line1,
          line2: address.line2 ?? null,
          city: address.city,
          region: address.region ?? null,
          instructions: address.instructions ?? null,
          deliveryZoneId: zone?.id ?? null,
          isDefault: count === 0,
        },
      });
    }

    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    await tx.cart.update({ where: { id: cart.id }, data: { discountCode: null } });

    return order;
  }, TRANSACTION_OPTIONS);

  return { orderId: result.id, number: result.number, accessToken, total: result.total };
}
