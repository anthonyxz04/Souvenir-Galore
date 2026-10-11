"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { absoluteUrl, env } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth/session";
import { currentCartId } from "@/lib/cart/service";
import { CheckoutError, placeOrder, type CheckoutAddress } from "@/lib/checkout/place-order";
import { sendEmail } from "@/lib/email";
import { adminNewOrderEmail, orderConfirmationEmail, type OrderEmailData } from "@/lib/email/templates";
import { formatMoney } from "@/lib/money";
import { paymentDetailsForCustomer } from "@/lib/payments/rules";
import { getAllSettings } from "@/lib/settings";
import { checkoutSchema, errorState, zodFieldErrors, type FormState } from "@/lib/validation/forms";

export async function placeOrderAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = checkoutSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return errorState("Check the highlighted fields.", zodFieldErrors(parsed.error), formData);
  const input = parsed.data;

  const [user, cartId] = await Promise.all([getCurrentUser(), currentCartId()]);
  if (!cartId) return errorState("Your cart is empty.");

  let address: CheckoutAddress | null = null;
  if (input.fulfillment === "DELIVERY") {
    if (input.savedAddressId && user) {
      const saved = await prisma.address.findFirst({ where: { id: input.savedAddressId, userId: user.id } });
      if (!saved) return errorState("Choose a delivery address.", { savedAddressId: "Choose a delivery address." }, formData);
      const zoneId = input.zoneId ?? saved.deliveryZoneId;
      if (!zoneId) return errorState("Choose your delivery area.", { zoneId: "Choose your delivery area." }, formData);
      address = {
        recipientName: saved.recipientName,
        phone: saved.phone,
        line1: saved.line1,
        line2: saved.line2,
        city: saved.city,
        region: saved.region,
        instructions: input.instructions ?? saved.instructions,
        zoneId,
      };
    } else {
      const errors: Record<string, string> = {};
      if (!input.recipientName) errors.recipientName = "Enter who will receive the order.";
      if (!input.addressPhone || input.addressPhone.replace(/\D/g, "").length < 6) errors.addressPhone = "Enter a phone number for the courier.";
      if (!input.line1 || input.line1.length < 3) errors.line1 = "Enter the street, building and floor.";
      if (!input.city) errors.city = "Enter the town or city.";
      if (!input.zoneId) errors.zoneId = "Choose your delivery area.";
      if (Object.keys(errors).length) return errorState("Check the delivery address.", errors, formData);
      address = {
        recipientName: input.recipientName!,
        phone: input.addressPhone!,
        line1: input.line1!,
        line2: input.line2,
        city: input.city!,
        region: input.region,
        instructions: input.instructions,
        zoneId: input.zoneId!,
      };
    }
  }

  let result;
  try {
    result = await placeOrder({
      cartId,
      userId: user?.id ?? null,
      email: user?.email ?? input.email,
      name: input.name,
      phone: input.phone,
      fulfillment: input.fulfillment,
      address,
      paymentMethodId: input.paymentMethodId,
      customerNote: input.customerNote,
      acceptTerms: input.acceptTerms,
      expectedTotal: input.expectedTotal ?? null,
      saveAddress: input.saveAddress && !input.savedAddressId,
    });
  } catch (error) {
    if (error instanceof CheckoutError) {
      revalidatePath("/checkout");
      return errorState(error.message, undefined, formData);
    }
    console.error("[checkout] order placement failed", error instanceof Error ? error.message : error);
    return errorState("We couldn't place your order because of a technical problem. Nothing was charged. Please try again in a moment.", undefined, formData);
  }

  await sendOrderEmails(result.orderId, result.accessToken);
  revalidatePath("/", "layout");
  redirect(`/order/${result.number}?token=${encodeURIComponent(result.accessToken)}&placed=1`);
}

async function sendOrderEmails(orderId: string, accessToken: string) {
  try {
    const [order, settings] = await Promise.all([
      prisma.order.findUnique({ where: { id: orderId }, include: { items: true, paymentMethod: true } }),
      getAllSettings(),
    ]);
    if (!order) return;
    const currency = { code: order.currency, decimals: settings.commerce.currencyDecimals, locale: settings.commerce.currencyLocale };
    const fmt = (minor: number) => formatMoney(minor, currency);
    const details = order.paymentMethod
      ? paymentDetailsForCustomer({ ...order.paymentMethod, config: (order.paymentMethod.config ?? {}) as Record<string, unknown> })
      : [];
    const data: OrderEmailData = {
      number: order.number,
      customerName: order.customerName,
      items: order.items.map((item) => ({
        name: item.variantTitle ? `${item.productName} (${item.variantTitle})` : item.productName,
        quantity: item.quantity,
        total: fmt(item.lineTotal),
        details: Array.isArray(item.personalization)
          ? (item.personalization as { label: string; value: string }[]).map((p) => `${p.label}: ${p.value}`).join("\n")
          : undefined,
      })),
      subtotal: fmt(order.subtotal),
      discount: order.discountTotal ? fmt(order.discountTotal) : undefined,
      delivery: order.fulfillmentMethod === "PICKUP" ? "Free" : fmt(order.deliveryFee),
      tax: order.taxTotal ? `${fmt(order.taxTotal)}${order.taxIncluded ? " (included)" : ""}` : undefined,
      total: fmt(order.total),
      fulfillment: order.fulfillmentMethod === "PICKUP" ? "Pickup" : "Delivery",
      paymentMethod: order.paymentMethodName,
      paymentInstructions: order.paymentMethodType === "CASH_ON_DELIVERY" ? undefined : order.paymentMethod?.instructions ?? undefined,
      paymentDetails: order.paymentMethodType === "CASH_ON_DELIVERY" ? undefined : details,
      orderUrl: absoluteUrl(`/order/${order.number}?token=${encodeURIComponent(accessToken)}`),
    };
    await sendEmail({ to: order.email, ...orderConfirmationEmail(settings.store.name, data) });
    if (env.adminNotificationEmails.length) {
      await sendEmail({ to: env.adminNotificationEmails, ...adminNewOrderEmail(settings.store.name, data, absoluteUrl(`/admin/orders/${order.id}`)) });
    }
    await prisma.orderEvent.create({ data: { orderId: order.id, type: "EMAIL_SENT", message: "Order confirmation email sent.", isInternal: true } });
  } catch (error) {
    console.error("[checkout] failed to send order emails", error instanceof Error ? error.message : error);
  }
}
