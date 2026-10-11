/**
 * Order totals. The same function runs in the browser (live checkout summary)
 * and on the server (authoritative totals when the order is placed), so the
 * customer always reviews exactly what they will be charged.
 * Covered by tests/unit/totals.test.ts.
 */

import { divRoundHalfUp } from "../money";
import { discountAmount, type DiscountRule } from "../discounts/evaluate";

export type TotalsLine = {
  unitPrice: number;
  personalizationPrice: number;
  quantity: number;
};

export type TaxConfig = {
  enabled: boolean;
  /** Basis points: 1100 = 11%. */
  rateBps: number;
  /** true when catalog prices already include tax (common for VAT). */
  included: boolean;
};

export type DeliveryQuote = {
  fee: number;
  freeAboveSubtotal: number | null;
};

export type TotalsInput = {
  lines: TotalsLine[];
  discount: DiscountRule | null;
  /** null for pickup orders (no delivery fee). */
  delivery: DeliveryQuote | null;
  tax: TaxConfig;
};

export type Totals = {
  subtotal: number;
  discountTotal: number;
  deliveryFee: number;
  freeDeliveryApplied: boolean;
  taxTotal: number;
  taxIncluded: boolean;
  total: number;
};

export function lineTotal(line: TotalsLine): number {
  return (line.unitPrice + line.personalizationPrice) * line.quantity;
}

export function computeTotals(input: TotalsInput): Totals {
  const subtotal = input.lines.reduce((sum, line) => sum + lineTotal(line), 0);

  const discount = input.discount ? discountAmount(input.discount, subtotal) : { amount: 0, freeDelivery: false };
  const discountTotal = discount.amount;
  const goodsAfterDiscount = subtotal - discountTotal;

  let deliveryFee = 0;
  let freeDeliveryApplied = false;
  if (input.delivery) {
    const qualifiesForThreshold =
      input.delivery.freeAboveSubtotal !== null && goodsAfterDiscount >= input.delivery.freeAboveSubtotal;
    if (discount.freeDelivery || qualifiesForThreshold) {
      freeDeliveryApplied = input.delivery.fee > 0;
      deliveryFee = 0;
    } else {
      deliveryFee = Math.max(0, input.delivery.fee);
    }
  }

  let taxTotal = 0;
  let total = goodsAfterDiscount + deliveryFee;
  if (input.tax.enabled && input.tax.rateBps > 0 && goodsAfterDiscount > 0) {
    if (input.tax.included) {
      taxTotal = divRoundHalfUp(goodsAfterDiscount * input.tax.rateBps, 10_000 + input.tax.rateBps);
    } else {
      taxTotal = divRoundHalfUp(goodsAfterDiscount * input.tax.rateBps, 10_000);
      total += taxTotal;
    }
  }

  return {
    subtotal,
    discountTotal,
    deliveryFee,
    freeDeliveryApplied,
    taxTotal,
    taxIncluded: input.tax.enabled && input.tax.included,
    total,
  };
}
