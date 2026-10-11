import { describe, expect, it } from "vitest";
import {
  allowedOrderTransitions,
  canTransitionOrder,
  canTransitionPayment,
  customerCanRequestCancellation,
  customerCanSubmitPayment,
  orderStatusLabel,
  trackerSteps,
} from "@/lib/orders/status";

describe("order (fulfillment) status", () => {
  it("follows the delivery lifecycle", () => {
    expect(canTransitionOrder("PENDING", "CONFIRMED", "DELIVERY")).toBe(true);
    expect(canTransitionOrder("CONFIRMED", "PREPARING", "DELIVERY")).toBe(true);
    expect(canTransitionOrder("PREPARING", "SHIPPED", "DELIVERY")).toBe(true);
    expect(canTransitionOrder("SHIPPED", "DELIVERED", "DELIVERY")).toBe(true);
  });

  it("uses Ready for pickup instead of Shipped for pickup orders", () => {
    expect(canTransitionOrder("PREPARING", "READY_FOR_PICKUP", "PICKUP")).toBe(true);
    expect(canTransitionOrder("PREPARING", "SHIPPED", "PICKUP")).toBe(false);
    expect(canTransitionOrder("PREPARING", "READY_FOR_PICKUP", "DELIVERY")).toBe(false);
    expect(orderStatusLabel("DELIVERED", "PICKUP")).toBe("Picked up");
  });

  it("does not allow skipping back or leaving final states", () => {
    expect(canTransitionOrder("DELIVERED", "PREPARING", "DELIVERY")).toBe(false);
    expect(allowedOrderTransitions("CANCELLED", "DELIVERY")).toEqual([]);
    expect(canTransitionOrder("PENDING", "DELIVERED", "DELIVERY")).toBe(false);
  });

  it("has a tracker per fulfillment method", () => {
    expect(trackerSteps("PICKUP")).toContain("READY_FOR_PICKUP");
    expect(trackerSteps("DELIVERY")).toContain("SHIPPED");
  });
});

describe("payment status", () => {
  it("moves a manual payment through review to paid", () => {
    expect(canTransitionPayment("AWAITING_PAYMENT", "UNDER_REVIEW")).toBe(true);
    expect(canTransitionPayment("UNDER_REVIEW", "PAID")).toBe(true);
  });

  it("can send a rejected payment back to awaiting payment", () => {
    expect(canTransitionPayment("UNDER_REVIEW", "AWAITING_PAYMENT")).toBe(true);
  });

  it("only refunds paid orders", () => {
    expect(canTransitionPayment("PAID", "REFUNDED")).toBe(true);
    expect(canTransitionPayment("AWAITING_PAYMENT", "REFUNDED")).toBe(false);
    expect(canTransitionPayment("REFUNDED", "PAID")).toBe(false);
  });
});

describe("customer actions", () => {
  it("lets customers submit a payment reference only while payment is expected", () => {
    expect(customerCanSubmitPayment({ status: "PENDING", paymentStatus: "AWAITING_PAYMENT" })).toBe(true);
    expect(customerCanSubmitPayment({ status: "PENDING", paymentStatus: "UNDER_REVIEW" })).toBe(false);
    expect(customerCanSubmitPayment({ status: "PENDING", paymentStatus: "PAID" })).toBe(false);
    expect(customerCanSubmitPayment({ status: "CANCELLED", paymentStatus: "AWAITING_PAYMENT" })).toBe(false);
  });

  it("lets customers request cancellation before production starts, once", () => {
    expect(customerCanRequestCancellation({ status: "PENDING", cancellationRequestedAt: null })).toBe(true);
    expect(customerCanRequestCancellation({ status: "CONFIRMED", cancellationRequestedAt: null })).toBe(true);
    expect(customerCanRequestCancellation({ status: "PREPARING", cancellationRequestedAt: null })).toBe(false);
    expect(customerCanRequestCancellation({ status: "PENDING", cancellationRequestedAt: new Date() })).toBe(false);
  });
});
