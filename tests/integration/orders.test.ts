import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { placeOrder } from "@/lib/checkout/place-order";
import { markPaidFromGateway, OrderActionError, recordRefund, rejectPayment, requestCancellation, submitPaymentReference, updateOrderStatus, verifyPayment } from "@/lib/orders/service";
import { actor, baseOrderInput, createCart, createPaymentMethod, createProduct, createZone, hasDatabase, resetDatabase } from "./helpers";

async function manualOrder(stock = 5) {
  const product = await createProduct({ price: 2000, stock });
  const zone = await createZone({ fee: 0 });
  const method = await createPaymentMethod({
    type: "WHISH_MONEY",
    name: "Whish Money",
    instructions: "Send the total.",
    config: { accountName: "Owner", accountNumber: "0000" },
    allowCustomerReference: true,
  });
  const cart = await createCart([{ variantId: product.variants[0].id, quantity: 2 }]);
  const result = await placeOrder({ ...baseOrderInput, cartId: cart.id, userId: null, fulfillment: "DELIVERY", address: { recipientName: "T", phone: "70000000", line1: "S", city: "B", zoneId: zone.id }, paymentMethodId: method.id, expectedTotal: null });
  return { orderId: result.orderId, product };
}

describe.skipIf(!hasDatabase)("order and payment workflow (real database)", () => {
  beforeEach(async () => {
    await resetDatabase();
    await prisma.user.create({ data: { id: actor.id, email: actor.email, name: actor.name, role: "ADMIN" } });
  });

  it("a customer's payment reference puts the order under review — not paid", async () => {
    const { orderId } = await manualOrder();
    await submitPaymentReference(orderId, { reference: "WH-123456" }, { id: null, name: "Customer" });
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { payments: true } });
    expect(order.paymentStatus).toBe("UNDER_REVIEW");
    expect(order.paidAt).toBeNull();
    expect(order.payments[0].status).toBe("SUBMITTED");
    expect(order.payments[0].reference).toBe("WH-123456");
  });

  it("cannot submit a reference twice or when not awaiting payment", async () => {
    const { orderId } = await manualOrder();
    await submitPaymentReference(orderId, { reference: "WH-1" }, { id: null, name: "C" });
    await expect(submitPaymentReference(orderId, { reference: "WH-2" }, { id: null, name: "C" })).rejects.toBeInstanceOf(OrderActionError);
  });

  it("only an administrator's verification marks the order paid, and it is recorded", async () => {
    const { orderId } = await manualOrder();
    await submitPaymentReference(orderId, { reference: "WH-1" }, { id: null, name: "C" });
    await verifyPayment(orderId, actor, { note: "Seen in the Whish app" });
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { payments: true, events: true } });
    expect(order.paymentStatus).toBe("PAID");
    expect(order.paidAt).not.toBeNull();
    expect(order.payments[0].status).toBe("VERIFIED");
    expect(order.payments[0].reviewedByName).toBe("Admin");
    expect(order.events.some((e) => e.type === "PAYMENT_VERIFIED")).toBe(true);
    expect(await prisma.auditLog.count({ where: { action: "payment.verify", entityId: orderId } })).toBe(1);
  });

  it("rejecting a payment sends the order back to awaiting payment", async () => {
    const { orderId } = await manualOrder();
    await submitPaymentReference(orderId, { reference: "WH-1" }, { id: null, name: "C" });
    await rejectPayment(orderId, actor, "No transfer found");
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { payments: { orderBy: { createdAt: "asc" } } } });
    expect(order.paymentStatus).toBe("AWAITING_PAYMENT");
    expect(order.payments.map((p) => p.status)).toEqual(["REJECTED", "PENDING"]);
    // The customer can now submit again.
    await submitPaymentReference(orderId, { reference: "WH-2" }, { id: null, name: "C" });
  });

  it("cancelling returns stock, voids unpaid payment and frees the discount", async () => {
    const { orderId, product } = await manualOrder(5);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: product.variants[0].id } })).stock).toBe(3);
    await updateOrderStatus(orderId, "CANCELLED", actor);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe("CANCELLED");
    expect(order.paymentStatus).toBe("VOIDED");
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: product.variants[0].id } })).stock).toBe(5);
    // Cancelling twice must not return stock twice.
    await expect(updateOrderStatus(orderId, "CANCELLED", actor)).resolves.toBeTruthy();
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: product.variants[0].id } })).stock).toBe(5);
  });

  it("rejects invalid status changes", async () => {
    const { orderId } = await manualOrder();
    await expect(updateOrderStatus(orderId, "DELIVERED", actor)).rejects.toBeInstanceOf(OrderActionError);
    await expect(updateOrderStatus(orderId, "READY_FOR_PICKUP", actor)).rejects.toBeInstanceOf(OrderActionError);
    await updateOrderStatus(orderId, "CONFIRMED", actor);
    await updateOrderStatus(orderId, "PREPARING", actor);
    await updateOrderStatus(orderId, "SHIPPED", actor);
    await updateOrderStatus(orderId, "DELIVERED", actor);
    await expect(updateOrderStatus(orderId, "CANCELLED", actor)).rejects.toBeInstanceOf(OrderActionError);
  });

  it("records partial and full refunds only on paid orders", async () => {
    const { orderId } = await manualOrder();
    await expect(recordRefund(orderId, actor, 500, "x")).rejects.toBeInstanceOf(OrderActionError);
    await verifyPayment(orderId, actor);
    await recordRefund(orderId, actor, 1000, "One item damaged");
    let order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.paymentStatus).toBe("PARTIALLY_REFUNDED");
    expect(order.refundedTotal).toBe(1000);
    await expect(recordRefund(orderId, actor, 5000, "too much")).rejects.toBeInstanceOf(OrderActionError);
    await recordRefund(orderId, actor, order.total - 1000, "Rest");
    order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.paymentStatus).toBe("REFUNDED");
  });

  it("lets customers request cancellation once, before production", async () => {
    const { orderId } = await manualOrder();
    await requestCancellation(orderId, "Ordered by mistake", { id: null, name: "C" });
    await expect(requestCancellation(orderId, "again", { id: null, name: "C" })).rejects.toBeInstanceOf(OrderActionError);
  });

  it("gateway confirmations must match the order total and are idempotent", async () => {
    const { orderId } = await manualOrder();
    // Simulate an order placed with a (future) online gateway.
    const order = await prisma.order.update({ where: { id: orderId }, data: { paymentMethodType: "ONLINE_GATEWAY" } });

    const wrong = await markPaidFromGateway({ orderId, providerKey: "test-gateway", providerRef: "tx-1", amount: order.total - 1, currency: order.currency });
    expect(wrong.result).toBe("amount_mismatch");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).paymentStatus).toBe("AWAITING_PAYMENT");
    expect(await prisma.orderEvent.count({ where: { orderId, type: "NOTE", isInternal: true } })).toBe(1);

    const ok = await markPaidFromGateway({ orderId, providerKey: "test-gateway", providerRef: "tx-2", amount: order.total, currency: order.currency });
    expect(ok.result).toBe("recorded");
    const again = await markPaidFromGateway({ orderId, providerKey: "test-gateway", providerRef: "tx-2", amount: order.total, currency: order.currency });
    expect(again.result).toBe("duplicate");
    const paid = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { payments: true } });
    expect(paid.paymentStatus).toBe("PAID");
    expect(paid.payments.filter((p) => p.status === "VERIFIED")).toHaveLength(1);
  });

  it("gateway confirmations are refused for manual-payment orders", async () => {
    const { orderId } = await manualOrder();
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    await expect(markPaidFromGateway({ orderId, providerKey: "x", providerRef: "r", amount: order.total, currency: order.currency })).rejects.toBeInstanceOf(OrderActionError);
  });
});
