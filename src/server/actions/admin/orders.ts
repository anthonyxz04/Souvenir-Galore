"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { absoluteUrl } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { orderStatusEmail, paymentRejectedEmail, paymentVerifiedEmail } from "@/lib/email/templates";
import { formatMoney, parseMoney } from "@/lib/money";
import { addOrderNote, recordRefund, rejectPayment, updateOrderStatus, verifyPayment } from "@/lib/orders/service";
import { orderStatusLabel } from "@/lib/orders/status";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/domain";
import { getAllSettings } from "@/lib/settings";
import type { FormState } from "@/lib/validation/forms";
import { actorOf, AdminActionError, guarded } from "@/server/guard";

async function orderLink(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { number: true, userId: true, email: true, customerName: true, total: true, currency: true } });
  if (!order) throw new AdminActionError("Order not found.");
  // Signed-in customers see orders in their account; guests use the link from their confirmation email.
  return { order, url: absoluteUrl(order.userId ? `/account/orders/${order.number}` : `/order/${order.number}`) };
}

function refresh(orderId: string) {
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
}

export async function updateOrderStatusAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return guarded("orders:manage", async (user) => {
    const orderId = String(formData.get("orderId") ?? "");
    const status = String(formData.get("status") ?? "") as OrderStatus;
    if (!ORDER_STATUSES.includes(status)) throw new AdminActionError("Choose a status.");
    const note = String(formData.get("note") ?? "").slice(0, 1000);
    const updated = await updateOrderStatus(orderId, status, actorOf(user), note || undefined);
    if (formData.get("notify") === "on") {
      const { order, url } = await orderLink(orderId);
      const store = (await getAllSettings()).store;
      await sendEmail({
        to: order.email,
        ...orderStatusEmail(store.name, { number: order.number, customerName: order.customerName, statusLabel: orderStatusLabel(updated.status, updated.fulfillmentMethod), message: note || undefined, orderUrl: url }),
      });
    }
    refresh(orderId);
    return { status: "success", message: `Order marked as ${orderStatusLabel(updated.status, updated.fulfillmentMethod).toLowerCase()}.` };
  });
}

export async function verifyPaymentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return guarded("payments:verify", async (user) => {
    const orderId = String(formData.get("orderId") ?? "");
    const note = String(formData.get("note") ?? "").slice(0, 500);
    const reference = String(formData.get("reference") ?? "").slice(0, 120);
    await verifyPayment(orderId, actorOf(user), { note, reference });
    if (formData.get("notify") !== "off") {
      const { order, url } = await orderLink(orderId);
      const settings = await getAllSettings();
      const currency = { code: order.currency, decimals: settings.commerce.currencyDecimals, locale: settings.commerce.currencyLocale };
      await sendEmail({ to: order.email, ...paymentVerifiedEmail(settings.store.name, { number: order.number, customerName: order.customerName, amount: formatMoney(order.total, currency), orderUrl: url }) });
    }
    refresh(orderId);
    return { status: "success", message: "Payment recorded as received. The order is now marked as paid." };
  });
}

export async function rejectPaymentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return guarded("payments:verify", async (user) => {
    const orderId = String(formData.get("orderId") ?? "");
    const reason = String(formData.get("reason") ?? "").slice(0, 500);
    await rejectPayment(orderId, actorOf(user), reason);
    const { order, url } = await orderLink(orderId);
    const store = (await getAllSettings()).store;
    await sendEmail({ to: order.email, ...paymentRejectedEmail(store.name, { number: order.number, customerName: order.customerName, reason: reason || undefined, orderUrl: url }) });
    refresh(orderId);
    return { status: "success", message: "The customer was asked to check their payment details." };
  });
}

export async function recordRefundAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return guarded("payments:verify", async (user) => {
    const orderId = String(formData.get("orderId") ?? "");
    const settings = await getAllSettings();
    const amount = parseMoney(String(formData.get("amount") ?? ""), settings.commerce.currencyDecimals);
    if (amount === null || amount <= 0) throw new AdminActionError("Enter the refunded amount, for example 12.50.");
    const note = String(formData.get("note") ?? "").slice(0, 500);
    await recordRefund(orderId, actorOf(user), amount, note);
    refresh(orderId);
    return { status: "success", message: "Refund recorded." };
  });
}

export async function addOrderNoteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return guarded("orders:manage", async (user) => {
    const orderId = String(formData.get("orderId") ?? "");
    const message = String(formData.get("message") ?? "");
    const visible = formData.get("visibleToCustomer") === "on";
    await addOrderNote(orderId, actorOf(user), message, visible);
    if (visible && formData.get("notify") === "on") {
      const { order, url } = await orderLink(orderId);
      const store = (await getAllSettings()).store;
      await sendEmail({ to: order.email, ...orderStatusEmail(store.name, { number: order.number, customerName: order.customerName, statusLabel: "updated", message: message.trim(), orderUrl: url }) });
    }
    refresh(orderId);
    return { status: "success", message: visible ? "Message added to the order." : "Internal note saved." };
  });
}
