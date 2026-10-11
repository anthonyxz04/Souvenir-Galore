import { describe, expect, it } from "vitest";
import {
  checkDiscount,
  describeDiscount,
  discountAmount,
  discountErrorMessage,
  normalizeDiscountCode,
  type DiscountRecord,
} from "@/lib/discounts/evaluate";

const now = new Date("2026-10-10T12:00:00Z");
const base: DiscountRecord = {
  code: "WELCOME10",
  type: "PERCENTAGE",
  value: 10,
  maxDiscountAmount: null,
  minSubtotal: null,
  startsAt: null,
  endsAt: null,
  usageLimit: null,
  perCustomerLimit: null,
  usageCount: 0,
  isActive: true,
};
const fmt = (minor: number) => `$${(minor / 100).toFixed(2)}`;

describe("checkDiscount", () => {
  it("accepts a valid code", () => {
    const result = checkDiscount(base, { subtotal: 5000, now });
    expect(result.ok).toBe(true);
  });

  it("rejects unknown and inactive codes", () => {
    expect(checkDiscount(null, { subtotal: 5000, now })).toEqual({ ok: false, error: "NOT_FOUND" });
    expect(checkDiscount({ ...base, isActive: false }, { subtotal: 5000, now })).toEqual({ ok: false, error: "NOT_FOUND" });
  });

  it("enforces start and end dates", () => {
    expect(checkDiscount({ ...base, startsAt: new Date("2026-11-01") }, { subtotal: 5000, now })).toMatchObject({ error: "NOT_STARTED" });
    expect(checkDiscount({ ...base, endsAt: new Date("2026-10-01") }, { subtotal: 5000, now })).toMatchObject({ error: "EXPIRED" });
  });

  it("enforces the total usage limit", () => {
    expect(checkDiscount({ ...base, usageLimit: 100, usageCount: 100 }, { subtotal: 5000, now })).toMatchObject({ error: "USAGE_LIMIT" });
    expect(checkDiscount({ ...base, usageLimit: 100, usageCount: 99 }, { subtotal: 5000, now }).ok).toBe(true);
  });

  it("enforces the per-customer limit when the customer is known", () => {
    const limited = { ...base, perCustomerLimit: 1 };
    expect(checkDiscount(limited, { subtotal: 5000, now, customerRedemptions: 1 })).toMatchObject({ error: "CUSTOMER_LIMIT" });
    expect(checkDiscount(limited, { subtotal: 5000, now, customerRedemptions: 0 }).ok).toBe(true);
    expect(checkDiscount(limited, { subtotal: 5000, now, customerRedemptions: null }).ok).toBe(true);
  });

  it("enforces a minimum spend", () => {
    const result = checkDiscount({ ...base, minSubtotal: 6000 }, { subtotal: 5000, now });
    expect(result).toEqual({ ok: false, error: "MIN_SUBTOTAL", minSubtotal: 6000 });
    if (!result.ok) expect(discountErrorMessage(result, fmt)).toBe("Spend at least $60.00 to use this code.");
  });
});

describe("discountAmount", () => {
  it("calculates percentage discounts, rounding down", () => {
    expect(discountAmount({ type: "PERCENTAGE", value: 10, maxDiscountAmount: null }, 999)).toEqual({ amount: 99, freeDelivery: false });
  });

  it("caps percentage discounts", () => {
    expect(discountAmount({ type: "PERCENTAGE", value: 50, maxDiscountAmount: 500 }, 10_000).amount).toBe(500);
  });

  it("never exceeds the subtotal", () => {
    expect(discountAmount({ type: "FIXED_AMOUNT", value: 5000, maxDiscountAmount: null }, 1200).amount).toBe(1200);
    expect(discountAmount({ type: "PERCENTAGE", value: 150, maxDiscountAmount: null }, 1200).amount).toBe(1200);
  });

  it("flags free delivery", () => {
    expect(discountAmount({ type: "FREE_DELIVERY", value: 0, maxDiscountAmount: null }, 1200)).toEqual({ amount: 0, freeDelivery: true });
  });
});

describe("helpers", () => {
  it("normalizes codes", () => {
    expect(normalizeDiscountCode("  welcome 10 ")).toBe("WELCOME10");
  });

  it("describes discounts", () => {
    expect(describeDiscount({ type: "PERCENTAGE", value: 15, maxDiscountAmount: null }, fmt)).toBe("15% off");
    expect(describeDiscount({ type: "FIXED_AMOUNT", value: 500, maxDiscountAmount: null }, fmt)).toBe("$5.00 off");
    expect(describeDiscount({ type: "FREE_DELIVERY", value: 0, maxDiscountAmount: null }, fmt)).toBe("Free delivery");
  });
});
