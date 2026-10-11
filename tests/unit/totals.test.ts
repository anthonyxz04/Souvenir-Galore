import { describe, expect, it } from "vitest";
import { computeTotals } from "@/lib/cart/totals";

const noTax = { enabled: false, rateBps: 0, included: false };
const lines = [
  { unitPrice: 2000, personalizationPrice: 0, quantity: 2 }, // 40.00
  { unitPrice: 1500, personalizationPrice: 300, quantity: 1 }, // 18.00
];

describe("computeTotals", () => {
  it("sums lines including personalization extras", () => {
    const totals = computeTotals({ lines, discount: null, delivery: null, tax: noTax });
    expect(totals.subtotal).toBe(5800);
    expect(totals.total).toBe(5800);
    expect(totals.deliveryFee).toBe(0);
  });

  it("adds the delivery fee for delivery orders", () => {
    const totals = computeTotals({ lines, discount: null, delivery: { fee: 400, freeAboveSubtotal: null }, tax: noTax });
    expect(totals.deliveryFee).toBe(400);
    expect(totals.total).toBe(6200);
  });

  it("waives delivery above the free-delivery threshold (after discounts)", () => {
    const free = computeTotals({ lines, discount: null, delivery: { fee: 400, freeAboveSubtotal: 5000 }, tax: noTax });
    expect(free.deliveryFee).toBe(0);
    expect(free.freeDeliveryApplied).toBe(true);

    const notFree = computeTotals({
      lines,
      discount: { type: "FIXED_AMOUNT", value: 1000, maxDiscountAmount: null },
      delivery: { fee: 400, freeAboveSubtotal: 5000 },
      tax: noTax,
    });
    expect(notFree.discountTotal).toBe(1000);
    expect(notFree.deliveryFee).toBe(400);
    expect(notFree.total).toBe(5800 - 1000 + 400);
  });

  it("applies percentage discounts with a cap", () => {
    const totals = computeTotals({
      lines,
      discount: { type: "PERCENTAGE", value: 50, maxDiscountAmount: 1000 },
      delivery: null,
      tax: noTax,
    });
    expect(totals.discountTotal).toBe(1000);
    expect(totals.total).toBe(4800);
  });

  it("applies free-delivery codes", () => {
    const totals = computeTotals({
      lines,
      discount: { type: "FREE_DELIVERY", value: 0, maxDiscountAmount: null },
      delivery: { fee: 400, freeAboveSubtotal: null },
      tax: noTax,
    });
    expect(totals.deliveryFee).toBe(0);
    expect(totals.discountTotal).toBe(0);
    expect(totals.total).toBe(5800);
  });

  it("never discounts below zero", () => {
    const totals = computeTotals({
      lines: [{ unitPrice: 500, personalizationPrice: 0, quantity: 1 }],
      discount: { type: "FIXED_AMOUNT", value: 10_000, maxDiscountAmount: null },
      delivery: null,
      tax: noTax,
    });
    expect(totals.discountTotal).toBe(500);
    expect(totals.total).toBe(0);
  });

  it("extracts included VAT without changing the total", () => {
    // $110.00 including 10% VAT → VAT is $10.00
    const totals = computeTotals({
      lines: [{ unitPrice: 11000, personalizationPrice: 0, quantity: 1 }],
      discount: null,
      delivery: null,
      tax: { enabled: true, rateBps: 1000, included: true },
    });
    expect(totals.taxTotal).toBe(1000);
    expect(totals.taxIncluded).toBe(true);
    expect(totals.total).toBe(11000);
  });

  it("adds tax on top when prices exclude tax", () => {
    // $100.00 + 11% = $111.00, delivery is not taxed
    const totals = computeTotals({
      lines: [{ unitPrice: 10000, personalizationPrice: 0, quantity: 1 }],
      discount: null,
      delivery: { fee: 500, freeAboveSubtotal: null },
      tax: { enabled: true, rateBps: 1100, included: false },
    });
    expect(totals.taxTotal).toBe(1100);
    expect(totals.total).toBe(10000 + 1100 + 500);
  });

  it("rounds tax half up to the minor unit", () => {
    // 11% of 0.05 = 0.0055 → 1 cent
    const totals = computeTotals({
      lines: [{ unitPrice: 5, personalizationPrice: 0, quantity: 1 }],
      discount: null,
      delivery: null,
      tax: { enabled: true, rateBps: 1100, included: false },
    });
    expect(totals.taxTotal).toBe(1);
  });
});
