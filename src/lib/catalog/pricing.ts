/**
 * Pure pricing, availability and badge rules for products and variants.
 * No database or framework imports — covered by tests/unit/pricing.test.ts.
 */

export type SaleWindow = {
  saleStartsAt: Date | null;
  saleEndsAt: Date | null;
};

export type PricedVariant = {
  price: number;
  salePrice: number | null;
  isActive?: boolean;
};

export type EffectivePrice = {
  /** What the customer pays per unit (before personalization extras). */
  price: number;
  /** The regular price to show struck through, when on sale. */
  compareAt: number | null;
  onSale: boolean;
};

export function isSaleWindowOpen(window: SaleWindow, now: Date = new Date()): boolean {
  if (window.saleStartsAt && now < window.saleStartsAt) return false;
  if (window.saleEndsAt && now > window.saleEndsAt) return false;
  return true;
}

export function effectiveVariantPrice(
  variant: PricedVariant,
  window: SaleWindow,
  now: Date = new Date(),
): EffectivePrice {
  const hasSale = variant.salePrice !== null && variant.salePrice >= 0 && variant.salePrice < variant.price;
  if (hasSale && isSaleWindowOpen(window, now)) {
    return { price: variant.salePrice as number, compareAt: variant.price, onSale: true };
  }
  return { price: variant.price, compareAt: null, onSale: false };
}

export type PriceRange = {
  min: number;
  max: number;
  /** Lowest regular price among variants currently on sale (for strike-through on cards). */
  compareAtMin: number | null;
  onSale: boolean;
};

export function priceRange(
  variants: PricedVariant[],
  window: SaleWindow,
  now: Date = new Date(),
): PriceRange | null {
  const active = variants.filter((v) => v.isActive !== false);
  if (active.length === 0) return null;
  let min = Infinity;
  let max = -Infinity;
  let compareAtMin: number | null = null;
  let onSale = false;
  for (const variant of active) {
    const effective = effectiveVariantPrice(variant, window, now);
    min = Math.min(min, effective.price);
    max = Math.max(max, effective.price);
    if (effective.onSale) {
      onSale = true;
      compareAtMin = compareAtMin === null ? variant.price : Math.min(compareAtMin, variant.price);
    }
  }
  return { min, max, compareAtMin, onSale };
}

/**
 * Values stored on Product for fast filtering and sorting. Regular prices are
 * used for priceMin/priceMax; salePriceMin lets filters include sale prices
 * while the sale window is open.
 */
export function denormalizedPrices(variants: PricedVariant[]): {
  priceMin: number;
  priceMax: number;
  salePriceMin: number | null;
} {
  const active = variants.filter((v) => v.isActive !== false);
  if (active.length === 0) return { priceMin: 0, priceMax: 0, salePriceMin: null };
  const prices = active.map((v) => v.price);
  const salePrices = active
    .filter((v) => v.salePrice !== null && (v.salePrice as number) < v.price)
    .map((v) => v.salePrice as number);
  return {
    priceMin: Math.min(...prices),
    priceMax: Math.max(...prices),
    salePriceMin: salePrices.length ? Math.min(...salePrices) : null,
  };
}

// ─────────────────────────────────────────────────────────────
// Availability
// ─────────────────────────────────────────────────────────────

export type InventoryProduct = {
  trackInventory: boolean;
  allowBackorder: boolean;
  madeToOrder: boolean;
  lowStockThreshold: number | null;
};

export type AvailabilityStatus = "in_stock" | "low_stock" | "out_of_stock" | "backorder" | "made_to_order";

export type Availability = {
  status: AvailabilityStatus;
  purchasable: boolean;
  /** Maximum quantity that can be ordered right now; null = no stock limit. */
  maxQuantity: number | null;
};

export function variantAvailability(
  variant: { stock: number; isActive?: boolean },
  product: InventoryProduct,
  defaultLowStockThreshold = 3,
): Availability {
  if (variant.isActive === false) return { status: "out_of_stock", purchasable: false, maxQuantity: 0 };

  if (!product.trackInventory) {
    return { status: product.madeToOrder ? "made_to_order" : "in_stock", purchasable: true, maxQuantity: null };
  }

  const threshold = product.lowStockThreshold ?? defaultLowStockThreshold;

  if (variant.stock > 0) {
    if (product.madeToOrder) {
      return { status: "made_to_order", purchasable: true, maxQuantity: product.allowBackorder ? null : variant.stock };
    }
    return {
      status: variant.stock <= threshold ? "low_stock" : "in_stock",
      purchasable: true,
      maxQuantity: product.allowBackorder ? null : variant.stock,
    };
  }

  if (product.allowBackorder) {
    return { status: product.madeToOrder ? "made_to_order" : "backorder", purchasable: true, maxQuantity: null };
  }
  return { status: "out_of_stock", purchasable: false, maxQuantity: 0 };
}

export function availabilityLabel(status: AvailabilityStatus, stock?: number): string {
  switch (status) {
    case "in_stock":
      return "In stock";
    case "low_stock":
      return stock !== undefined ? `Only ${stock} left` : "Low stock";
    case "out_of_stock":
      return "Sold out";
    case "backorder":
      return "Available to order — ships when restocked";
    case "made_to_order":
      return "Made to order";
  }
}

export function prepTimeLabel(minDays: number | null, maxDays: number | null): string | null {
  if (!minDays && !maxDays) return null;
  if (minDays && maxDays && minDays !== maxDays) return `Handmade in ${minDays}–${maxDays} days`;
  const days = (maxDays ?? minDays) as number;
  return `Handmade in ${days} ${days === 1 ? "day" : "days"}`;
}

// ─────────────────────────────────────────────────────────────
// Badges
// ─────────────────────────────────────────────────────────────

export type BadgeKey = "sale" | "new" | "bestseller" | "limited" | "sold-out";

export type BadgeInput = SaleWindow & {
  publishedAt: Date | null;
  isBestseller: boolean;
  isLimitedEdition: boolean;
  inStock: boolean;
  onSale: boolean;
};

export function productBadges(product: BadgeInput, now: Date = new Date(), newBadgeDays = 30): { key: BadgeKey; label: string }[] {
  const badges: { key: BadgeKey; label: string }[] = [];
  if (!product.inStock) badges.push({ key: "sold-out", label: "Sold out" });
  if (product.onSale) badges.push({ key: "sale", label: "Sale" });
  if (product.publishedAt && newBadgeDays > 0) {
    const ageMs = now.getTime() - product.publishedAt.getTime();
    if (ageMs >= 0 && ageMs <= newBadgeDays * 86_400_000) badges.push({ key: "new", label: "New" });
  }
  if (product.isBestseller) badges.push({ key: "bestseller", label: "Bestseller" });
  if (product.isLimitedEdition) badges.push({ key: "limited", label: "Limited edition" });
  return badges;
}

// ─────────────────────────────────────────────────────────────
// Variants
// ─────────────────────────────────────────────────────────────

export type OptionDef = { name: string; values: string[] };

/** All combinations of option values, e.g. [["S","Vanilla"],["S","Oud"],…]. Max 3 options. */
export function variantCombinations(options: OptionDef[]): string[][] {
  const usable = options.filter((o) => o.name.trim() && o.values.length > 0).slice(0, 3);
  if (usable.length === 0) return [];
  return usable.reduce<string[][]>(
    (acc, option) => acc.flatMap((combo) => option.values.map((value) => [...combo, value])),
    [[]],
  );
}

export function variantTitle(values: (string | null | undefined)[]): string {
  const parts = values.filter((v): v is string => Boolean(v));
  return parts.length ? parts.join(" / ") : "Default";
}
