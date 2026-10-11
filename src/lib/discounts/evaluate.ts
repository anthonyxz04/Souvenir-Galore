/**
 * Discount-code rules. Pure — the database layer loads the discount and the
 * customer's previous redemptions, then calls these functions.
 * Covered by tests/unit/discounts.test.ts.
 */

import type { DiscountType } from "../domain";
import { percentOf } from "../money";

export type DiscountRule = {
  type: DiscountType;
  value: number;
  maxDiscountAmount: number | null;
};

export type DiscountRecord = DiscountRule & {
  code: string;
  minSubtotal: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  usageLimit: number | null;
  perCustomerLimit: number | null;
  usageCount: number;
  isActive: boolean;
};

export type DiscountErrorCode =
  | "NOT_FOUND"
  | "NOT_STARTED"
  | "EXPIRED"
  | "USAGE_LIMIT"
  | "CUSTOMER_LIMIT"
  | "MIN_SUBTOTAL";

export type DiscountCheck =
  | { ok: true; rule: DiscountRule; code: string }
  | { ok: false; error: DiscountErrorCode; minSubtotal?: number };

export type DiscountContext = {
  subtotal: number;
  now?: Date;
  /** How many times this customer (by account or email) already used the code. Null when unknown yet. */
  customerRedemptions?: number | null;
};

export function normalizeDiscountCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export function checkDiscount(discount: DiscountRecord | null, context: DiscountContext): DiscountCheck {
  const now = context.now ?? new Date();
  if (!discount || !discount.isActive) return { ok: false, error: "NOT_FOUND" };
  if (discount.startsAt && now < discount.startsAt) return { ok: false, error: "NOT_STARTED" };
  if (discount.endsAt && now > discount.endsAt) return { ok: false, error: "EXPIRED" };
  if (discount.usageLimit !== null && discount.usageCount >= discount.usageLimit) {
    return { ok: false, error: "USAGE_LIMIT" };
  }
  if (
    discount.perCustomerLimit !== null &&
    context.customerRedemptions !== null &&
    context.customerRedemptions !== undefined &&
    context.customerRedemptions >= discount.perCustomerLimit
  ) {
    return { ok: false, error: "CUSTOMER_LIMIT" };
  }
  if (discount.minSubtotal !== null && context.subtotal < discount.minSubtotal) {
    return { ok: false, error: "MIN_SUBTOTAL", minSubtotal: discount.minSubtotal };
  }
  return {
    ok: true,
    code: discount.code,
    rule: { type: discount.type, value: discount.value, maxDiscountAmount: discount.maxDiscountAmount },
  };
}

/** Amount taken off the goods subtotal. Never exceeds the subtotal. */
export function discountAmount(rule: DiscountRule, subtotal: number): { amount: number; freeDelivery: boolean } {
  if (subtotal <= 0) return { amount: 0, freeDelivery: rule.type === "FREE_DELIVERY" };
  switch (rule.type) {
    case "PERCENTAGE": {
      const percent = Math.min(100, Math.max(0, rule.value));
      let amount = percentOf(subtotal, percent);
      if (rule.maxDiscountAmount !== null) amount = Math.min(amount, rule.maxDiscountAmount);
      return { amount: Math.min(amount, subtotal), freeDelivery: false };
    }
    case "FIXED_AMOUNT":
      return { amount: Math.min(Math.max(0, rule.value), subtotal), freeDelivery: false };
    case "FREE_DELIVERY":
      return { amount: 0, freeDelivery: true };
  }
}

export function discountErrorMessage(check: Extract<DiscountCheck, { ok: false }>, formatMoney: (minor: number) => string): string {
  switch (check.error) {
    case "NOT_FOUND":
      return "This code isn't valid.";
    case "NOT_STARTED":
      return "This code isn't active yet.";
    case "EXPIRED":
      return "This code has expired.";
    case "USAGE_LIMIT":
      return "This code has reached its usage limit.";
    case "CUSTOMER_LIMIT":
      return "You've already used this code.";
    case "MIN_SUBTOTAL":
      return `Spend at least ${formatMoney(check.minSubtotal ?? 0)} to use this code.`;
  }
}

export function describeDiscount(rule: DiscountRule, formatMoney: (minor: number) => string): string {
  switch (rule.type) {
    case "PERCENTAGE":
      return `${rule.value}% off${rule.maxDiscountAmount !== null ? ` (up to ${formatMoney(rule.maxDiscountAmount)})` : ""}`;
    case "FIXED_AMOUNT":
      return `${formatMoney(rule.value)} off`;
    case "FREE_DELIVERY":
      return "Free delivery";
  }
}
