/**
 * Order operations for administrators and customers. Every change is written
 * to the order history (OrderEvent) and, for admin actions, the audit log.
 * No Next.js imports — exercised by tests/integration/orders.test.ts.
 */

import { prisma, type Tx } from "../db";
import { logAudit } from "../audit";
import { syncProductDerived } from "../catalog/sync";
import type { OrderStatus } from "../domain";
import { canTransitionOrder, canTransitionPayment, customerCanRequestCancellation, customerCanSubmitPayment, orderStatusLabel } from "./status";

export class OrderActionError extends Error {}

export type Actor = { id: string; email: string; name: string };

async function lockOrder(tx: Tx, orderId: string) {
  // Row lock so concurrent admin actions on the same order are serialized.
  await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: { items: true, payments: { orderBy: { createdAt: "desc" } } },
  });
  if (!order) throw new OrderActionError("Order not found.");
  return order;
}

/** Return reserved stock to inventory (used when an order is cancelled). */
async function releaseStock(tx: Tx, orderId: string, actorId: string | null) {
  const movements = await tx.inventoryMovement.findMany({ where: { orderId, reason: "ORDER_PLACED" } });
  const alreadyReleased = await tx.inventoryMovement.count({ where: { orderId, reason: "ORDER_CANCELLED" } });
  if (alreadyReleased > 0) return;
  const touchedProducts = new Set<string>();
  for (const movement of movements) {
    const variant = await tx.productVariant.update({
      where: { id: movement.variantId },
      data: { stock: { increment: -movement.delta } },
      select: { stock: true, productId: true },
    });
    touchedProducts.add(variant.productId);
    await tx.inventoryMovement.create({
      data: { variantId: movement.variantId, delta: -movement.delta, stockAfter: variant.stock, reason: "ORDER_CANCELLED", orderId, actorId },
    });
  }
  for (const productId of touchedProducts) await syncProductDerived(productId, tx);
}

export async function updateOrderStatus(orderId: string, to: OrderStatus, actor: Actor, note?: string) {
  return prisma.$transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (order.status === to) return order;
    if (!canTransitionOrder(order.status, to, order.fulfillmentMethod)) {
      throw new OrderActionError(
        `An order can't move from ${orderStatusLabel(order.status, order.fulfillmentMethod)} to ${orderStatusLabel(to, order.fulfillmentMethod)}.`,
      );
    }
    const now = new Date();
    const data: Record<string, unknown> = { status: to };
    if (to === "CONFIRMED") data.confirmedAt = now;
    if (to === "DELIVERED") data.deliveredAt = now;
    if (to === "CANCELLED") {
      data.cancelledAt = now;
      await releaseStock(tx, order.id, actor.id);
      // Undo popularity counts and discount usage.
      for (const item of order.items) {
        if (item.productId) {
          await tx.product.updateMany({ where: { id: item.productId, salesCount: { gte: item.quantity } }, data: { salesCount: { decrement: item.quantity } } });
        }
      }
      if (order.discountId) {
        await tx.discount.updateMany({ where: { id: order.discountId, usageCount: { gt: 0 } }, data: { usageCount: { decrement: 1 } } });
        await tx.discountRedemption.deleteMany({ where: { orderId: order.id } });
      }
      if (["UNPAID", "AWAITING_PAYMENT", "UNDER_REVIEW"].includes(order.paymentStatus)) {
        data.paymentStatus = "VOIDED";
        await tx.payment.updateMany({ where: { orderId: order.id, status: { in: ["PENDING", "SUBMITTED"] } }, data: { status: "REJECTED", adminNote: "Order cancelled" } });
      }
    }
    const updated = await tx.order.update({ where: { id: order.id }, data });
    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        type: "STATUS_CHANGED",
        message: note?.trim() ? note.trim() : `Status changed to ${orderStatusLabel(to, order.fulfillmentMethod)}.`,
        fromValue: order.status,
        toValue: to,
        isInternal: false,
        actorId: actor.id,
        actorName: actor.name,
      },
    });
    if (to === "CANCELLED" && data.paymentStatus === "VOIDED") {
      await tx.orderEvent.create({
        data: { orderId: order.id, type: "PAYMENT_STATUS_CHANGED", message: "Payment voided because the order was cancelled.", fromValue: order.paymentStatus, toValue: "VOIDED", isInternal: true, actorId: actor.id, actorName: actor.name },
      });
    }
    await logAudit({ actor, action: "order.status", entityType: "Order", entityId: order.id, summary: `${order.number}: ${order.status} → ${to}` }, tx);
    return updated;
  });
}

/**
 * Administrator confirms that money was received (manual verification).
 * This is the ONLY way an order becomes PAID without a payment-gateway callback.
 */
export async function verifyPayment(orderId: string, actor: Actor, options: { note?: string; reference?: string } = {}) {
  return prisma.$transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (order.status === "CANCELLED") throw new OrderActionError("This order is cancelled.");
    if (!canTransitionPayment(order.paymentStatus, "PAID")) {
      throw new OrderActionError("This order's payment can't be marked as received in its current state.");
    }
    const now = new Date();
    const charge = order.payments.find((p) => p.kind === "CHARGE" && (p.status === "SUBMITTED" || p.status === "PENDING"));
    if (charge) {
      await tx.payment.update({
        where: { id: charge.id },
        data: {
          status: "VERIFIED",
          reviewedById: actor.id,
          reviewedByName: actor.name,
          reviewedAt: now,
          adminNote: options.note?.trim() || null,
          reference: charge.reference ?? options.reference?.trim() ?? null,
          amount: order.total,
        },
      });
    } else {
      await tx.payment.create({
        data: {
          orderId: order.id,
          paymentMethodId: order.paymentMethodId,
          methodType: order.paymentMethodType,
          methodName: order.paymentMethodName,
          kind: "CHARGE",
          amount: order.total,
          currency: order.currency,
          status: "VERIFIED",
          reference: options.reference?.trim() || null,
          reviewedById: actor.id,
          reviewedByName: actor.name,
          reviewedAt: now,
          adminNote: options.note?.trim() || null,
        },
      });
    }
    const updated = await tx.order.update({ where: { id: order.id }, data: { paymentStatus: "PAID", paidAt: now } });
    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        type: "PAYMENT_VERIFIED",
        message: "Payment received and verified.",
        fromValue: order.paymentStatus,
        toValue: "PAID",
        isInternal: false,
        actorId: actor.id,
        actorName: actor.name,
      },
    });
    await logAudit({ actor, action: "payment.verify", entityType: "Order", entityId: order.id, summary: `${order.number}: payment verified`, metadata: { note: options.note } }, tx);
    return updated;
  });
}

/**
 * For future online gateways only: record a payment that the provider has
 * confirmed SERVER-TO-SERVER (signed webhook or status API — never a browser
 * redirect). Idempotent per provider reference, and the confirmed amount and
 * currency must match the order exactly or nothing is marked paid.
 */
export async function markPaidFromGateway(input: { orderId: string; providerKey: string; providerRef: string; amount: number; currency: string }) {
  return prisma.$transaction(async (tx) => {
    const order = await lockOrder(tx, input.orderId);
    const duplicate = order.payments.find((p) => p.kind === "CHARGE" && p.providerRef === input.providerRef && p.status === "VERIFIED");
    if (duplicate) return { result: "duplicate" as const, order };
    if (order.paymentMethodType !== "ONLINE_GATEWAY") throw new OrderActionError("This order was not placed with an online gateway.");
    if (order.status === "CANCELLED") throw new OrderActionError("This order is cancelled; refund the payment from the provider dashboard.");
    if (input.amount !== order.total || input.currency.toUpperCase() !== order.currency.toUpperCase()) {
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          type: "NOTE",
          message: `Gateway reported ${input.amount} ${input.currency} (ref ${input.providerRef}), which does not match the order total. Not marked as paid — check the provider dashboard.`,
          isInternal: true,
          actorName: input.providerKey,
        },
      });
      // Returned (not thrown) so the internal note above is kept.
      return { result: "amount_mismatch" as const, order };
    }
    if (!canTransitionPayment(order.paymentStatus, "PAID")) throw new OrderActionError("This order's payment can't be marked as received in its current state.");
    const now = new Date();
    await tx.payment.create({
      data: {
        orderId: order.id,
        paymentMethodId: order.paymentMethodId,
        methodType: order.paymentMethodType,
        methodName: order.paymentMethodName,
        kind: "CHARGE",
        amount: input.amount,
        currency: order.currency,
        status: "VERIFIED",
        providerRef: input.providerRef,
        reviewedByName: input.providerKey,
        reviewedAt: now,
      },
    });
    const updated = await tx.order.update({ where: { id: order.id }, data: { paymentStatus: "PAID", paidAt: now } });
    await tx.orderEvent.create({
      data: { orderId: order.id, type: "PAYMENT_VERIFIED", message: "Online payment confirmed by the payment provider.", fromValue: order.paymentStatus, toValue: "PAID", isInternal: false, actorName: input.providerKey },
    });
    await logAudit({ actor: null, action: "payment.gateway_confirmed", entityType: "Order", entityId: order.id, summary: `${order.number}: paid via ${input.providerKey}`, metadata: { providerRef: input.providerRef } }, tx);
    return { result: "recorded" as const, order: updated };
  });
}

/** Administrator could not confirm a submitted payment; the customer can try again. */
export async function rejectPayment(orderId: string, actor: Actor, reason: string) {
  return prisma.$transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (order.paymentStatus !== "UNDER_REVIEW") throw new OrderActionError("There's no submitted payment to reject.");
    const submitted = order.payments.find((p) => p.status === "SUBMITTED");
    if (submitted) {
      await tx.payment.update({
        where: { id: submitted.id },
        data: { status: "REJECTED", reviewedById: actor.id, reviewedByName: actor.name, reviewedAt: new Date(), adminNote: reason.trim() || null },
      });
    }
    // A fresh pending charge so the customer can submit a new reference.
    await tx.payment.create({
      data: {
        orderId: order.id,
        paymentMethodId: order.paymentMethodId,
        methodType: order.paymentMethodType,
        methodName: order.paymentMethodName,
        kind: "CHARGE",
        amount: order.total,
        currency: order.currency,
        status: "PENDING",
      },
    });
    const updated = await tx.order.update({ where: { id: order.id }, data: { paymentStatus: "AWAITING_PAYMENT" } });
    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        type: "PAYMENT_REJECTED",
        message: reason.trim() ? `We couldn't confirm your payment: ${reason.trim()}` : "We couldn't confirm your payment yet.",
        fromValue: "UNDER_REVIEW",
        toValue: "AWAITING_PAYMENT",
        isInternal: false,
        actorId: actor.id,
        actorName: actor.name,
      },
    });
    await logAudit({ actor, action: "payment.reject", entityType: "Order", entityId: order.id, summary: `${order.number}: payment not confirmed`, metadata: { reason } }, tx);
    return updated;
  });
}

export async function recordRefund(orderId: string, actor: Actor, amount: number, note: string) {
  if (!Number.isInteger(amount) || amount <= 0) throw new OrderActionError("Enter a refund amount greater than zero.");
  return prisma.$transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (order.paymentStatus !== "PAID" && order.paymentStatus !== "PARTIALLY_REFUNDED") {
      throw new OrderActionError("Only paid orders can be refunded.");
    }
    const remaining = order.total - order.refundedTotal;
    if (amount > remaining) throw new OrderActionError("The refund is larger than the amount left to refund.");
    const refundedTotal = order.refundedTotal + amount;
    const paymentStatus = refundedTotal >= order.total ? "REFUNDED" : "PARTIALLY_REFUNDED";
    await tx.payment.create({
      data: {
        orderId: order.id,
        paymentMethodId: order.paymentMethodId,
        methodType: order.paymentMethodType,
        methodName: order.paymentMethodName,
        kind: "REFUND",
        amount,
        currency: order.currency,
        status: "REFUNDED",
        reviewedById: actor.id,
        reviewedByName: actor.name,
        reviewedAt: new Date(),
        adminNote: note.trim() || null,
      },
    });
    const updated = await tx.order.update({ where: { id: order.id }, data: { refundedTotal, paymentStatus } });
    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        type: "REFUND_RECORDED",
        message: `Refund recorded${note.trim() ? `: ${note.trim()}` : "."}`,
        fromValue: order.paymentStatus,
        toValue: paymentStatus,
        isInternal: false,
        actorId: actor.id,
        actorName: actor.name,
      },
    });
    await logAudit({ actor, action: "payment.refund", entityType: "Order", entityId: order.id, summary: `${order.number}: refund ${amount}`, metadata: { amount, note } }, tx);
    return updated;
  });
}

export async function addOrderNote(orderId: string, actor: Actor, message: string, visibleToCustomer: boolean) {
  const text = message.trim().slice(0, 2000);
  if (!text) throw new OrderActionError("Write a note first.");
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, number: true } });
  if (!order) throw new OrderActionError("Order not found.");
  await prisma.orderEvent.create({
    data: { orderId, type: "NOTE", message: text, isInternal: !visibleToCustomer, actorId: actor.id, actorName: actor.name },
  });
  await logAudit({ actor, action: "order.note", entityType: "Order", entityId: orderId, summary: `${order.number}: ${visibleToCustomer ? "customer message" : "internal note"}` });
}

// ─────────────────────────────────────────────────────────────
// Customer actions
// ─────────────────────────────────────────────────────────────

/**
 * The customer reports that they sent a manual payment (e.g. a Whish transfer).
 * This moves the order to UNDER_REVIEW — it does NOT mark it as paid.
 */
export async function submitPaymentReference(
  orderId: string,
  input: { reference: string; note?: string | null },
  customer: { id: string | null; name: string },
) {
  const reference = input.reference.trim().slice(0, 120);
  if (reference.length < 3) throw new OrderActionError("Enter the transaction reference from your payment.");
  return prisma.$transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (!customerCanSubmitPayment(order)) throw new OrderActionError("This order isn't waiting for a payment.");
    const method = order.paymentMethodId
      ? await tx.paymentMethod.findUnique({ where: { id: order.paymentMethodId }, select: { allowCustomerReference: true } })
      : null;
    if (!method?.allowCustomerReference) throw new OrderActionError("This payment method doesn't use transaction references.");

    const pending = order.payments.find((p) => p.kind === "CHARGE" && p.status === "PENDING");
    if (pending) {
      await tx.payment.update({ where: { id: pending.id }, data: { status: "SUBMITTED", reference, customerNote: input.note?.trim().slice(0, 500) || null } });
    } else {
      await tx.payment.create({
        data: {
          orderId: order.id,
          paymentMethodId: order.paymentMethodId,
          methodType: order.paymentMethodType,
          methodName: order.paymentMethodName,
          kind: "CHARGE",
          amount: order.total,
          currency: order.currency,
          status: "SUBMITTED",
          reference,
          customerNote: input.note?.trim().slice(0, 500) || null,
        },
      });
    }
    await tx.order.update({ where: { id: order.id }, data: { paymentStatus: "UNDER_REVIEW" } });
    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        type: "PAYMENT_SUBMITTED",
        message: `Payment reference submitted (${reference}). Waiting for verification.`,
        fromValue: "AWAITING_PAYMENT",
        toValue: "UNDER_REVIEW",
        isInternal: false,
        actorId: customer.id,
        actorName: customer.name,
      },
    });
    return order;
  });
}

export async function requestCancellation(orderId: string, reason: string, customer: { id: string | null; name: string }) {
  return prisma.$transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (!customerCanRequestCancellation(order)) {
      throw new OrderActionError("This order can no longer be cancelled online. Please contact us.");
    }
    const text = reason.trim().slice(0, 500);
    await tx.order.update({ where: { id: order.id }, data: { cancellationRequestedAt: new Date(), cancellationReason: text || null } });
    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        type: "CANCELLATION_REQUESTED",
        message: text ? `Cancellation requested: ${text}` : "Cancellation requested.",
        isInternal: false,
        actorId: customer.id,
        actorName: customer.name,
      },
    });
    return order;
  });
}

// ─────────────────────────────────────────────────────────────
// Inventory adjustments
// ─────────────────────────────────────────────────────────────

export async function adjustStock(variantId: string, delta: number, actor: Actor, note: string, reason: "MANUAL_ADJUSTMENT" | "RESTOCK" | "RETURN" = "MANUAL_ADJUSTMENT") {
  if (!Number.isInteger(delta) || delta === 0) throw new OrderActionError("Enter a whole number other than zero.");
  return prisma.$transaction(async (tx) => {
    const variant = await tx.productVariant.update({ where: { id: variantId }, data: { stock: { increment: delta } }, select: { stock: true, productId: true, title: true } });
    await tx.inventoryMovement.create({ data: { variantId, delta, stockAfter: variant.stock, reason, actorId: actor.id, note: note.trim() || null } });
    await syncProductDerived(variant.productId, tx);
    await logAudit({ actor, action: "inventory.adjust", entityType: "ProductVariant", entityId: variantId, summary: `${variant.title}: ${delta > 0 ? "+" : ""}${delta} → ${variant.stock}`, metadata: { note } }, tx);
    return variant;
  });
}
