import "server-only";
import { cookies } from "next/headers";
import { prisma } from "../db";
import { env } from "../env";
import { generateToken, sha256 } from "../auth/crypto";
import { getCurrentUser } from "../auth/session";
import { effectiveVariantPrice, variantAvailability } from "../catalog/pricing";
import { getSettings } from "../settings";
import { personalizationFingerprint, validatePersonalization, type PersonalizationValue } from "../personalization";
import type { MediaRef } from "../storage/urls";

/**
 * Server-side shopping cart. Guests get a random token in an httpOnly cookie;
 * signed-in customers have one cart tied to their account that persists across
 * devices. Prices are always recalculated from the database — never trusted
 * from the browser.
 */

export const GUEST_CART_COOKIE = env.secureCookies ? "__Host-sg_cart" : "sg_cart";
const GUEST_CART_DAYS = 60;

export class CartError extends Error {}

export type CartLine = {
  id: string;
  quantity: number;
  variantId: string;
  productId: string;
  productSlug: string;
  productName: string;
  variantTitle: string | null;
  sku: string | null;
  image: (MediaRef & { alt: string }) | null;
  unitPrice: number;
  compareAt: number | null;
  personalizationPrice: number;
  personalization: { label: string; value: string }[];
  lineTotal: number;
  maxQuantity: number | null;
  madeToOrder: boolean;
  prepTimeMaxDays: number | null;
  issue: string | null;
};

export type CartView = {
  id: string | null;
  lines: CartLine[];
  discountCode: string | null;
  itemCount: number;
  subtotal: number;
  hasIssues: boolean;
};

const EMPTY_CART: CartView = { id: null, lines: [], discountCode: null, itemCount: 0, subtotal: 0, hasIssues: false };

async function readGuestToken(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(GUEST_CART_COOKIE)?.value;
  return token && token.length >= 32 && token.length <= 128 ? token : null;
}

/** Find the current cart id without creating one. */
async function findCartId(): Promise<string | null> {
  const user = await getCurrentUser();
  if (user) {
    const cart = await prisma.cart.findUnique({ where: { userId: user.id }, select: { id: true } });
    return cart?.id ?? null;
  }
  const token = await readGuestToken();
  if (!token) return null;
  const cart = await prisma.cart.findUnique({ where: { guestTokenHash: sha256(token) }, select: { id: true } });
  return cart?.id ?? null;
}

/** Find or create the current cart. Sets the guest cookie when needed (Server Actions only). */
async function ensureCartId(): Promise<string> {
  const user = await getCurrentUser();
  if (user) {
    const cart = await prisma.cart.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {}, select: { id: true } });
    return cart.id;
  }
  const existing = await findCartId();
  if (existing) return existing;
  const token = generateToken();
  const cart = await prisma.cart.create({ data: { guestTokenHash: sha256(token) }, select: { id: true } });
  const jar = await cookies();
  jar.set(GUEST_CART_COOKIE, token, {
    httpOnly: true,
    secure: env.secureCookies,
    sameSite: "lax",
    path: "/",
    maxAge: GUEST_CART_DAYS * 86_400,
  });
  return cart.id;
}

const cartInclude = {
  items: {
    orderBy: { createdAt: "asc" as const },
    include: {
      variant: {
        include: {
          product: {
            select: {
              id: true,
              slug: true,
              name: true,
              status: true,
              pricingType: true,
              trackInventory: true,
              allowBackorder: true,
              madeToOrder: true,
              lowStockThreshold: true,
              maxPerOrder: true,
              prepTimeMaxDays: true,
              saleStartsAt: true,
              saleEndsAt: true,
              personalizationFields: true,
              images: {
                orderBy: { position: "asc" as const },
                take: 1,
                select: { alt: true, asset: { select: { key: true, renditions: true, width: true, height: true, alt: true } } },
              },
            },
          },
        },
      },
    },
  },
};

export async function loadCart(cartId: string | null): Promise<CartView> {
  if (!cartId) return EMPTY_CART;
  const cart = await prisma.cart.findUnique({ where: { id: cartId }, include: cartInclude });
  if (!cart) return EMPTY_CART;
  const commerce = await getSettings("commerce");
  const now = new Date();

  const lines: CartLine[] = cart.items.map((item) => {
    const { variant } = item;
    const product = variant.product;
    const price = effectiveVariantPrice(variant, product, now);
    const availability = variantAvailability(variant, product, commerce.lowStockThreshold);
    const stored = (Array.isArray(item.personalization) ? item.personalization : []) as PersonalizationValue[];

    // Re-price personalization from the current field definitions.
    let personalizationPrice = 0;
    let issue: string | null = null;
    for (const value of stored) {
      const field = product.personalizationFields.find((f) => f.id === value.fieldId);
      if (!field) {
        issue = "The personalization options for this item changed. Remove it and add it again.";
        continue;
      }
      personalizationPrice += Math.max(0, field.priceDelta);
    }
    const missingRequired = product.personalizationFields.some(
      (field) => field.isRequired && !stored.some((value) => value.fieldId === field.id),
    );
    if (missingRequired) issue = "This item needs personalization details. Remove it and add it again.";

    const caps = [availability.maxQuantity, product.maxPerOrder, commerce.maxQuantityPerLine].filter(
      (n): n is number => typeof n === "number",
    );
    const maxQuantity = caps.length ? Math.min(...caps) : null;

    if (product.status !== "ACTIVE" || !variant.isActive) issue = "This item is no longer available.";
    else if (product.pricingType === "QUOTE") issue = "This item is made to quote. Request a quote instead.";
    else if (!availability.purchasable) issue = "This item is sold out.";
    else if (maxQuantity !== null && item.quantity > maxQuantity) {
      issue = maxQuantity > 0 ? `Only ${maxQuantity} available. Lower the quantity to continue.` : "This item is sold out.";
    }

    const image = product.images[0];
    return {
      id: item.id,
      quantity: item.quantity,
      variantId: variant.id,
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      variantTitle: variant.title === "Default" ? null : variant.title,
      sku: variant.sku,
      image: image ? { ...image.asset, alt: image.alt || image.asset.alt || product.name } : null,
      unitPrice: price.price,
      compareAt: price.compareAt,
      personalizationPrice,
      personalization: stored.map((value) => ({ label: value.label, value: value.value })),
      lineTotal: (price.price + personalizationPrice) * item.quantity,
      maxQuantity,
      madeToOrder: product.madeToOrder,
      prepTimeMaxDays: product.prepTimeMaxDays,
      issue,
    };
  });

  return {
    id: cart.id,
    lines,
    discountCode: cart.discountCode,
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotal: lines.reduce((sum, line) => sum + line.lineTotal, 0),
    hasIssues: lines.some((line) => line.issue !== null),
  };
}

export async function getCart(): Promise<CartView> {
  return loadCart(await findCartId());
}

export async function getCartCount(): Promise<number> {
  const cartId = await findCartId();
  if (!cartId) return 0;
  const result = await prisma.cartItem.aggregate({ where: { cartId }, _sum: { quantity: true } });
  return result._sum.quantity ?? 0;
}

export async function addToCart(input: {
  variantId: string;
  quantity: number;
  personalization: Record<string, unknown>;
}): Promise<{ count: number }> {
  const quantity = Math.floor(input.quantity);
  if (!Number.isFinite(quantity) || quantity < 1) throw new CartError("Choose a quantity of at least 1.");

  const variant = await prisma.productVariant.findUnique({
    where: { id: input.variantId },
    include: { product: { include: { personalizationFields: { orderBy: { position: "asc" } } } } },
  });
  if (!variant || !variant.isActive || variant.product.status !== "ACTIVE") throw new CartError("This item is no longer available.");
  if (variant.product.pricingType === "QUOTE") throw new CartError("This item is made to quote. Request a quote instead.");

  const personalization = validatePersonalization(variant.product.personalizationFields, input.personalization);
  if (!personalization.ok) throw new CartError(Object.values(personalization.errors)[0] ?? "Check the personalization details.");

  const commerce = await getSettings("commerce");
  const availability = variantAvailability(variant, variant.product, commerce.lowStockThreshold);
  if (!availability.purchasable) throw new CartError("This item is sold out.");

  const fingerprint = personalizationFingerprint(personalization.values);
  const key = fingerprint ? sha256(fingerprint).slice(0, 40) : "";
  const cartId = await ensureCartId();

  const existing = await prisma.cartItem.findUnique({
    where: { cartId_variantId_personalizationKey: { cartId, variantId: variant.id, personalizationKey: key } },
    select: { quantity: true },
  });
  const nextQuantity = (existing?.quantity ?? 0) + quantity;
  const caps = [availability.maxQuantity, variant.product.maxPerOrder, commerce.maxQuantityPerLine].filter(
    (n): n is number => typeof n === "number",
  );
  const max = caps.length ? Math.min(...caps) : null;
  if (max !== null && nextQuantity > max) {
    throw new CartError(existing ? `You already have ${existing.quantity} in your cart — the most you can order is ${max}.` : `The most you can order is ${max}.`);
  }

  await prisma.cartItem.upsert({
    where: { cartId_variantId_personalizationKey: { cartId, variantId: variant.id, personalizationKey: key } },
    create: {
      cartId,
      variantId: variant.id,
      quantity,
      personalizationKey: key,
      personalization: personalization.values.length ? (personalization.values as object[]) : undefined,
    },
    update: { quantity: nextQuantity },
  });
  await prisma.cart.update({ where: { id: cartId }, data: { updatedAt: new Date() } });
  return { count: await getCartCount() };
}

async function ownedItem(itemId: string) {
  const cartId = await findCartId();
  if (!cartId) throw new CartError("Your cart is empty.");
  const item = await prisma.cartItem.findFirst({ where: { id: itemId, cartId }, select: { id: true, cartId: true } });
  if (!item) throw new CartError("That item is no longer in your cart.");
  return item;
}

export async function updateCartItemQuantity(itemId: string, quantity: number): Promise<void> {
  const item = await ownedItem(itemId);
  const q = Math.floor(quantity);
  if (!Number.isFinite(q) || q < 1) {
    await prisma.cartItem.delete({ where: { id: item.id } });
    return;
  }
  const commerce = await getSettings("commerce");
  await prisma.cartItem.update({ where: { id: item.id }, data: { quantity: Math.min(q, commerce.maxQuantityPerLine) } });
}

export async function removeCartItem(itemId: string): Promise<void> {
  const item = await ownedItem(itemId);
  await prisma.cartItem.delete({ where: { id: item.id } });
}

export async function setCartDiscountCode(code: string | null): Promise<void> {
  const cartId = await ensureCartId();
  await prisma.cart.update({ where: { id: cartId }, data: { discountCode: code } });
}

/**
 * After login or registration, move the guest cart's items into the account
 * cart (quantities add up) and delete the guest cart.
 */
export async function mergeGuestCart(userId: string): Promise<void> {
  const token = await readGuestToken();
  const jar = await cookies();
  if (!token) return;
  const guest = await prisma.cart.findUnique({ where: { guestTokenHash: sha256(token) }, include: { items: true } });
  jar.delete(GUEST_CART_COOKIE);
  if (!guest) return;

  await prisma.$transaction(async (tx) => {
    const userCart = await tx.cart.upsert({ where: { userId }, create: { userId }, update: {}, select: { id: true, discountCode: true } });
    for (const item of guest.items) {
      const existing = await tx.cartItem.findUnique({
        where: {
          cartId_variantId_personalizationKey: { cartId: userCart.id, variantId: item.variantId, personalizationKey: item.personalizationKey },
        },
      });
      if (existing) {
        await tx.cartItem.update({ where: { id: existing.id }, data: { quantity: existing.quantity + item.quantity } });
      } else {
        await tx.cartItem.create({
          data: {
            cartId: userCart.id,
            variantId: item.variantId,
            quantity: item.quantity,
            personalizationKey: item.personalizationKey,
            personalization: item.personalization ?? undefined,
          },
        });
      }
    }
    if (!userCart.discountCode && guest.discountCode) {
      await tx.cart.update({ where: { id: userCart.id }, data: { discountCode: guest.discountCode } });
    }
    await tx.cart.delete({ where: { id: guest.id } });
  });
}

export async function currentCartId(): Promise<string | null> {
  return findCartId();
}
