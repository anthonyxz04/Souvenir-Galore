import { describe, expect, it } from "vitest";
import {
  availabilityLabel,
  denormalizedPrices,
  effectiveVariantPrice,
  prepTimeLabel,
  priceRange,
  productBadges,
  variantAvailability,
  variantCombinations,
  variantTitle,
} from "@/lib/catalog/pricing";

const noWindow = { saleStartsAt: null, saleEndsAt: null };
const now = new Date("2026-10-10T12:00:00Z");

describe("effectiveVariantPrice", () => {
  it("uses the regular price without a sale", () => {
    expect(effectiveVariantPrice({ price: 2500, salePrice: null }, noWindow, now)).toEqual({
      price: 2500,
      compareAt: null,
      onSale: false,
    });
  });

  it("applies a sale price inside the window", () => {
    const window = { saleStartsAt: new Date("2026-10-01"), saleEndsAt: new Date("2026-10-31") };
    expect(effectiveVariantPrice({ price: 2500, salePrice: 2000 }, window, now)).toEqual({
      price: 2000,
      compareAt: 2500,
      onSale: true,
    });
  });

  it("ignores the sale price before it starts and after it ends", () => {
    const future = { saleStartsAt: new Date("2026-11-01"), saleEndsAt: null };
    const past = { saleStartsAt: null, saleEndsAt: new Date("2026-10-01") };
    expect(effectiveVariantPrice({ price: 2500, salePrice: 2000 }, future, now).price).toBe(2500);
    expect(effectiveVariantPrice({ price: 2500, salePrice: 2000 }, past, now).price).toBe(2500);
  });

  it("ignores a sale price that is not lower than the regular price", () => {
    expect(effectiveVariantPrice({ price: 2500, salePrice: 2500 }, noWindow, now).onSale).toBe(false);
    expect(effectiveVariantPrice({ price: 2500, salePrice: 3000 }, noWindow, now).onSale).toBe(false);
  });
});

describe("priceRange and denormalizedPrices", () => {
  const variants = [
    { price: 1500, salePrice: null },
    { price: 2500, salePrice: 1900 },
    { price: 9900, salePrice: null, isActive: false },
  ];

  it("computes the active range including sale prices", () => {
    expect(priceRange(variants, noWindow, now)).toEqual({ min: 1500, max: 1900, compareAtMin: 2500, onSale: true });
  });

  it("returns null when no variant is active", () => {
    expect(priceRange([{ price: 100, salePrice: null, isActive: false }], noWindow, now)).toBeNull();
  });

  it("stores regular min/max and the lowest sale price", () => {
    expect(denormalizedPrices(variants)).toEqual({ priceMin: 1500, priceMax: 2500, salePriceMin: 1900 });
  });
});

describe("variantAvailability", () => {
  const tracked = { trackInventory: true, allowBackorder: false, madeToOrder: false, lowStockThreshold: null };

  it("reports in stock / low stock / sold out", () => {
    expect(variantAvailability({ stock: 10 }, tracked)).toEqual({ status: "in_stock", purchasable: true, maxQuantity: 10 });
    expect(variantAvailability({ stock: 2 }, tracked).status).toBe("low_stock");
    expect(variantAvailability({ stock: 0 }, tracked)).toEqual({ status: "out_of_stock", purchasable: false, maxQuantity: 0 });
  });

  it("respects a product-specific low-stock threshold", () => {
    expect(variantAvailability({ stock: 5 }, { ...tracked, lowStockThreshold: 5 }).status).toBe("low_stock");
    expect(variantAvailability({ stock: 5 }, { ...tracked, lowStockThreshold: 1 }).status).toBe("in_stock");
  });

  it("allows backorders only when enabled", () => {
    expect(variantAvailability({ stock: 0 }, { ...tracked, allowBackorder: true })).toEqual({
      status: "backorder",
      purchasable: true,
      maxQuantity: null,
    });
  });

  it("treats untracked made-to-order products as always available", () => {
    expect(
      variantAvailability({ stock: 0 }, { trackInventory: false, allowBackorder: false, madeToOrder: true, lowStockThreshold: null }),
    ).toEqual({ status: "made_to_order", purchasable: true, maxQuantity: null });
  });

  it("limits made-to-order capacity when inventory is tracked", () => {
    expect(variantAvailability({ stock: 4 }, { ...tracked, madeToOrder: true })).toEqual({
      status: "made_to_order",
      purchasable: true,
      maxQuantity: 4,
    });
  });

  it("never sells inactive variants", () => {
    expect(variantAvailability({ stock: 10, isActive: false }, tracked).purchasable).toBe(false);
  });

  it("has customer-facing labels", () => {
    expect(availabilityLabel("low_stock", 2)).toBe("Only 2 left");
    expect(availabilityLabel("out_of_stock")).toBe("Sold out");
  });
});

describe("badges", () => {
  const base = {
    saleStartsAt: null,
    saleEndsAt: null,
    publishedAt: new Date("2026-10-01"),
    isBestseller: true,
    isLimitedEdition: true,
    inStock: true,
    onSale: true,
  };

  it("shows the relevant badges", () => {
    expect(productBadges(base, now, 30).map((b) => b.key)).toEqual(["sale", "new", "bestseller", "limited"]);
  });

  it("drops New after the configured number of days", () => {
    expect(productBadges({ ...base, publishedAt: new Date("2026-08-01") }, now, 30).map((b) => b.key)).not.toContain("new");
  });

  it("marks sold-out products first", () => {
    expect(productBadges({ ...base, inStock: false }, now, 30)[0].key).toBe("sold-out");
  });
});

describe("variants", () => {
  it("builds every combination of option values", () => {
    expect(
      variantCombinations([
        { name: "Size", values: ["Small", "Large"] },
        { name: "Scent", values: ["Vanilla", "Oud", "Jasmine"] },
      ]),
    ).toHaveLength(6);
    expect(variantCombinations([{ name: "Size", values: ["S"] }])).toEqual([["S"]]);
    expect(variantCombinations([])).toEqual([]);
  });

  it("ignores empty options and caps at three", () => {
    const combos = variantCombinations([
      { name: "A", values: ["1", "2"] },
      { name: "", values: ["x"] },
      { name: "B", values: ["1"] },
      { name: "C", values: ["1"] },
      { name: "D", values: ["1", "2"] },
    ]);
    expect(combos).toHaveLength(2);
    expect(combos[0]).toHaveLength(3);
  });

  it("titles variants", () => {
    expect(variantTitle(["Large", "Oud", null])).toBe("Large / Oud");
    expect(variantTitle([null, undefined])).toBe("Default");
  });

  it("labels preparation times", () => {
    expect(prepTimeLabel(3, 5)).toBe("Handmade in 3–5 days");
    expect(prepTimeLabel(null, 1)).toBe("Handmade in 1 day");
    expect(prepTimeLabel(null, null)).toBeNull();
  });
});
