import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { CheckoutError, placeOrder } from "@/lib/checkout/place-order";
import { saveSettings } from "@/lib/settings";
import { baseOrderInput, createCart, createPaymentMethod, createProduct, createZone, hasDatabase, resetDatabase } from "./helpers";

describe.skipIf(!hasDatabase)("checkout (real database)", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("creates an order with server-side totals, an order number and a pending payment", async () => {
    const product = await createProduct({ price: 2000, stock: 5 });
    const zone = await createZone({ fee: 300 });
    const method = await createPaymentMethod();
    const cart = await createCart([{ variantId: product.variants[0].id, quantity: 2 }]);

    const result = await placeOrder({
      ...baseOrderInput,
      cartId: cart.id,
      userId: null,
      fulfillment: "DELIVERY",
      address: { recipientName: "Test", phone: "70000000", line1: "Street 1", city: "Beirut", zoneId: zone.id },
      paymentMethodId: method.id,
      expectedTotal: 4300,
    });

    expect(result.number).toMatch(/^SG-\d{5,}$/);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: result.orderId }, include: { items: true, payments: true, events: true } });
    expect(order.subtotal).toBe(4000);
    expect(order.deliveryFee).toBe(300);
    expect(order.total).toBe(4300);
    expect(order.status).toBe("PENDING");
    expect(order.paymentStatus).toBe("UNPAID");
    expect(order.payments).toHaveLength(1);
    expect(order.payments[0].status).toBe("PENDING");
    expect(order.items[0].productName).toBe(product.name);
    expect(order.events.some((e) => e.type === "CREATED")).toBe(true);

    const variant = await prisma.productVariant.findUniqueOrThrow({ where: { id: product.variants[0].id } });
    expect(variant.stock).toBe(3);
    const movement = await prisma.inventoryMovement.findFirstOrThrow({ where: { orderId: order.id } });
    expect(movement.delta).toBe(-2);
    expect(await prisma.cartItem.count({ where: { cartId: cart.id } })).toBe(0);
  });

  it("starts manual payments as awaiting payment, never paid", async () => {
    const product = await createProduct();
    const zone = await createZone();
    const whish = await createPaymentMethod({
      type: "WHISH_MONEY",
      name: "Whish Money",
      instructions: "Send the total and enter the reference.",
      config: { accountName: "Owner", accountNumber: "0000" },
      allowCustomerReference: true,
    });
    const cart = await createCart([{ variantId: product.variants[0].id, quantity: 1 }]);
    const result = await placeOrder({
      ...baseOrderInput,
      cartId: cart.id,
      userId: null,
      fulfillment: "DELIVERY",
      address: { recipientName: "T", phone: "70000000", line1: "Street", city: "Beirut", zoneId: zone.id },
      paymentMethodId: whish.id,
      expectedTotal: null,
    });
    const order = await prisma.order.findUniqueOrThrow({ where: { id: result.orderId } });
    expect(order.paymentStatus).toBe("AWAITING_PAYMENT");
    expect(order.paymentInstructions).toContain("Owner");
  });

  it("prevents overselling when customers race for the last items", async () => {
    const product = await createProduct({ stock: 3 });
    const zone = await createZone();
    const method = await createPaymentMethod();
    const carts = await Promise.all(Array.from({ length: 6 }, () => createCart([{ variantId: product.variants[0].id, quantity: 1 }])));

    const results = await Promise.allSettled(
      carts.map((cart, i) =>
        placeOrder({
          ...baseOrderInput,
          email: `buyer${i}@example.com`,
          cartId: cart.id,
          userId: null,
          fulfillment: "DELIVERY",
          address: { recipientName: "T", phone: "70000000", line1: "Street", city: "Beirut", zoneId: zone.id },
          paymentMethodId: method.id,
          expectedTotal: null,
        }),
      ),
    );

    const succeeded = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(succeeded).toHaveLength(3);
    expect(failed).toHaveLength(3);
    for (const failure of failed) expect(failure.reason).toBeInstanceOf(CheckoutError);
    const variant = await prisma.productVariant.findUniqueOrThrow({ where: { id: product.variants[0].id } });
    expect(variant.stock).toBe(0);
    expect(await prisma.order.count()).toBe(3);
  });

  it("rejects quantities above stock without changing anything", async () => {
    const product = await createProduct({ stock: 2 });
    const zone = await createZone();
    const method = await createPaymentMethod();
    const cart = await createCart([{ variantId: product.variants[0].id, quantity: 3 }]);
    await expect(
      placeOrder({ ...baseOrderInput, cartId: cart.id, userId: null, fulfillment: "DELIVERY", address: { recipientName: "T", phone: "70000000", line1: "S", city: "B", zoneId: zone.id }, paymentMethodId: method.id, expectedTotal: null }),
    ).rejects.toMatchObject({ code: "STOCK" });
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: product.variants[0].id } })).stock).toBe(2);
    expect(await prisma.order.count()).toBe(0);
    expect(await prisma.cartItem.count({ where: { cartId: cart.id } })).toBe(1);
  });

  it("allows backorders only when the product allows them", async () => {
    const product = await createProduct({ stock: 1, allowBackorder: true });
    const zone = await createZone();
    const method = await createPaymentMethod();
    const cart = await createCart([{ variantId: product.variants[0].id, quantity: 3 }]);
    const result = await placeOrder({ ...baseOrderInput, cartId: cart.id, userId: null, fulfillment: "DELIVERY", address: { recipientName: "T", phone: "70000000", line1: "S", city: "B", zoneId: zone.id }, paymentMethodId: method.id, expectedTotal: null });
    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: result.orderId } });
    expect(item.isBackorder).toBe(true);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: product.variants[0].id } })).stock).toBe(-2);
  });

  it("refuses disabled payment methods", async () => {
    const product = await createProduct();
    const zone = await createZone();
    const disabled = await createPaymentMethod({ isEnabled: false });
    const cart = await createCart([{ variantId: product.variants[0].id, quantity: 1 }]);
    await expect(
      placeOrder({ ...baseOrderInput, cartId: cart.id, userId: null, fulfillment: "DELIVERY", address: { recipientName: "T", phone: "70000000", line1: "S", city: "B", zoneId: zone.id }, paymentMethodId: disabled.id, expectedTotal: null }),
    ).rejects.toMatchObject({ code: "PAYMENT" });
  });

  it("refuses an enabled Whish method whose account details are missing", async () => {
    const product = await createProduct();
    const zone = await createZone();
    // Simulates a record switched on directly in the database without details.
    const incomplete = await createPaymentMethod({ type: "WHISH_MONEY", name: "Whish Money", instructions: "", config: {}, isEnabled: true });
    const cart = await createCart([{ variantId: product.variants[0].id, quantity: 1 }]);
    await expect(
      placeOrder({ ...baseOrderInput, cartId: cart.id, userId: null, fulfillment: "DELIVERY", address: { recipientName: "T", phone: "70000000", line1: "S", city: "B", zoneId: zone.id }, paymentMethodId: incomplete.id, expectedTotal: null }),
    ).rejects.toMatchObject({ code: "PAYMENT" });
  });

  it("refuses inactive delivery areas and disabled pickup", async () => {
    const product = await createProduct();
    const zone = await createZone({ isActive: false });
    const method = await createPaymentMethod();
    const cart = await createCart([{ variantId: product.variants[0].id, quantity: 1 }]);
    await expect(
      placeOrder({ ...baseOrderInput, cartId: cart.id, userId: null, fulfillment: "DELIVERY", address: { recipientName: "T", phone: "70000000", line1: "S", city: "B", zoneId: zone.id }, paymentMethodId: method.id, expectedTotal: null }),
    ).rejects.toMatchObject({ code: "DELIVERY" });
    await expect(placeOrder({ ...baseOrderInput, cartId: cart.id, userId: null, fulfillment: "PICKUP", address: null, paymentMethodId: method.id, expectedTotal: null })).rejects.toMatchObject({ code: "DELIVERY" });
  });

  it("does not place the order when the reviewed total no longer matches", async () => {
    const product = await createProduct({ price: 2000 });
    const zone = await createZone({ fee: 300 });
    const method = await createPaymentMethod();
    const cart = await createCart([{ variantId: product.variants[0].id, quantity: 1 }]);
    await expect(
      placeOrder({ ...baseOrderInput, cartId: cart.id, userId: null, fulfillment: "DELIVERY", address: { recipientName: "T", phone: "70000000", line1: "S", city: "B", zoneId: zone.id }, paymentMethodId: method.id, expectedTotal: 1999 }),
    ).rejects.toMatchObject({ code: "PRICE_CHANGED" });
  });

  it("charges personalization extras and stores the personalization", async () => {
    const product = await createProduct({ price: 2000, personalization: true });
    await saveSettings("pickup", { enabled: true }, null);
    const method = await createPaymentMethod();
    const field = product.personalizationFields[0];
    const cart = await createCart([{ variantId: product.variants[0].id, quantity: 2, personalization: [{ fieldId: field.id, label: "Name", value: "Maya", priceDelta: 250 }] }]);
    const result = await placeOrder({ ...baseOrderInput, cartId: cart.id, userId: null, fulfillment: "PICKUP", address: null, paymentMethodId: method.id, expectedTotal: 4500 });
    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: result.orderId } });
    expect(item.personalizationPrice).toBe(250);
    expect(item.lineTotal).toBe(4500);
    expect(item.personalization).toEqual([{ label: "Name", value: "Maya" }]);
  });

  it("enforces discount usage limits under concurrency", async () => {
    const product = await createProduct({ stock: 10 });
    const zone = await createZone();
    const method = await createPaymentMethod();
    await prisma.discount.create({ data: { code: "ONCE", type: "PERCENTAGE", value: 10, usageLimit: 1 } });
    const carts = await Promise.all([0, 1, 2].map(async () => prisma.cart.update({ where: { id: (await createCart([{ variantId: product.variants[0].id, quantity: 1 }])).id }, data: { discountCode: "ONCE" } })));
    const results = await Promise.allSettled(
      carts.map((cart, i) =>
        placeOrder({ ...baseOrderInput, email: `d${i}@example.com`, cartId: cart.id, userId: null, fulfillment: "DELIVERY", address: { recipientName: "T", phone: "70000000", line1: "S", city: "B", zoneId: zone.id }, paymentMethodId: method.id, expectedTotal: null }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const discount = await prisma.discount.findUniqueOrThrow({ where: { code: "ONCE" } });
    expect(discount.usageCount).toBe(1);
    expect(await prisma.discountRedemption.count()).toBe(1);
  });

  it("applies the minimum order amount", async () => {
    const product = await createProduct({ price: 500 });
    const zone = await createZone();
    const method = await createPaymentMethod();
    await saveSettings("commerce", { minOrderSubtotal: 1000 }, null);
    const cart = await createCart([{ variantId: product.variants[0].id, quantity: 1 }]);
    await expect(
      placeOrder({ ...baseOrderInput, cartId: cart.id, userId: null, fulfillment: "DELIVERY", address: { recipientName: "T", phone: "70000000", line1: "S", city: "B", zoneId: zone.id }, paymentMethodId: method.id, expectedTotal: null }),
    ).rejects.toMatchObject({ code: "CART" });
  });
});
