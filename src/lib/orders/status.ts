/**
 * Order and payment status rules. Fulfillment status (what happens to the goods)
 * and payment status (what happens to the money) are deliberately separate.
 * Covered by tests/unit/order-status.test.ts.
 */

import type { FulfillmentMethod, OrderStatus, PaymentStatus } from "../domain";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PREPARING: "Preparing",
  READY_FOR_PICKUP: "Ready for pickup",
  SHIPPED: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export function orderStatusLabel(status: OrderStatus, fulfillment: FulfillmentMethod): string {
  if (status === "DELIVERED" && fulfillment === "PICKUP") return "Picked up";
  return ORDER_STATUS_LABEL[status];
}

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  UNPAID: "Unpaid",
  AWAITING_PAYMENT: "Awaiting payment",
  UNDER_REVIEW: "Payment under review",
  PAID: "Paid",
  PARTIALLY_REFUNDED: "Partially refunded",
  REFUNDED: "Refunded",
  VOIDED: "Voided",
};

export type StatusTone = "neutral" | "info" | "warning" | "success" | "danger";

export const ORDER_STATUS_TONE: Record<OrderStatus, StatusTone> = {
  PENDING: "warning",
  CONFIRMED: "info",
  PREPARING: "info",
  READY_FOR_PICKUP: "info",
  SHIPPED: "info",
  DELIVERED: "success",
  CANCELLED: "danger",
};

export const PAYMENT_STATUS_TONE: Record<PaymentStatus, StatusTone> = {
  UNPAID: "neutral",
  AWAITING_PAYMENT: "warning",
  UNDER_REVIEW: "warning",
  PAID: "success",
  PARTIALLY_REFUNDED: "info",
  REFUNDED: "neutral",
  VOIDED: "neutral",
};

const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "READY_FOR_PICKUP", "SHIPPED", "CANCELLED"],
  PREPARING: ["READY_FOR_PICKUP", "SHIPPED", "CANCELLED"],
  READY_FOR_PICKUP: ["DELIVERED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

export function allowedOrderTransitions(from: OrderStatus, fulfillment: FulfillmentMethod): OrderStatus[] {
  return ORDER_TRANSITIONS[from].filter((to) => {
    if (fulfillment === "DELIVERY" && to === "READY_FOR_PICKUP") return false;
    if (fulfillment === "PICKUP" && to === "SHIPPED") return false;
    return true;
  });
}

export function canTransitionOrder(from: OrderStatus, to: OrderStatus, fulfillment: FulfillmentMethod): boolean {
  return allowedOrderTransitions(from, fulfillment).includes(to);
}

const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  UNPAID: ["PAID", "AWAITING_PAYMENT", "VOIDED"],
  AWAITING_PAYMENT: ["UNDER_REVIEW", "PAID", "VOIDED"],
  UNDER_REVIEW: ["PAID", "AWAITING_PAYMENT", "VOIDED"],
  PAID: ["PARTIALLY_REFUNDED", "REFUNDED"],
  PARTIALLY_REFUNDED: ["PARTIALLY_REFUNDED", "REFUNDED"],
  REFUNDED: [],
  VOIDED: [],
};

export function allowedPaymentTransitions(from: PaymentStatus): PaymentStatus[] {
  return PAYMENT_TRANSITIONS[from];
}

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[from].includes(to);
}

/** Customers may submit a payment reference only while payment is still expected. */
export function customerCanSubmitPayment(order: { status: OrderStatus; paymentStatus: PaymentStatus }): boolean {
  return order.status !== "CANCELLED" && order.paymentStatus === "AWAITING_PAYMENT";
}

/** Customers can ask to cancel before the order goes into production. */
export function customerCanRequestCancellation(order: {
  status: OrderStatus;
  cancellationRequestedAt: Date | null;
}): boolean {
  return (order.status === "PENDING" || order.status === "CONFIRMED") && order.cancellationRequestedAt === null;
}

/** Statuses that count as real revenue in analytics. */
export const REVENUE_PAYMENT_STATUSES: PaymentStatus[] = ["PAID", "PARTIALLY_REFUNDED"];
export const OUTSTANDING_PAYMENT_STATUSES: PaymentStatus[] = ["UNPAID", "AWAITING_PAYMENT", "UNDER_REVIEW"];

/** Customer-facing timeline steps for the order tracker. */
export function trackerSteps(fulfillment: FulfillmentMethod): OrderStatus[] {
  return fulfillment === "PICKUP"
    ? ["PENDING", "CONFIRMED", "PREPARING", "READY_FOR_PICKUP", "DELIVERED"]
    : ["PENDING", "CONFIRMED", "PREPARING", "SHIPPED", "DELIVERED"];
}
