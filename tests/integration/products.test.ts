import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { duplicateProduct, productPayloadSchema, ProductValidationError, saveProduct, type ProductPayload } from "@/lib/catalog/product-admin";
import { hasDatabase, resetDatabase } from "./helpers";

function payload(overrides: Partial<ProductPayload> = {}): ProductPayload {
  return productPayloadSchema.parse({
    name: "Concrete candle jar",
    slug: null,
    shortDescription: "Hand-cast",
    description: "",
    status: "ACTIVE",
    pricingType: "FIXED",
    isFeatured: false,
    isBestseller: false,
    isLimitedEdition: false,
    trackInventory: true,
    allowBackorder: false,
    madeToOrder: false,
    allowInquiry: true,
    lowStockThreshold: null,
    prepTimeMinDays: null,
    prepTimeMaxDays: null,
    maxPerOrder: null,
    saleStartsAt: null,
    saleEndsAt: null,
    seoTitle: null,
    seoDescription: null,
    options: [],
    variants: [{ option1: null, option2: null, option3: null, sku: "JAR-1", price: "18.00", salePrice: null, costPrice: "6.50", stock: 10, stockAdjustment: 0, isActive: true }],
    personalizationFields: [],
    images: [],
    categoryIds: [],
    collectionIds: [],
    tagIds: [],
    ...overrides,
  });
}

describe.skipIf(!hasDatabase)("product management (real database)", () => {
  beforeEach(async () => {
    await resetDatabase();
    await prisma.user.create({ data: { id: "actor", email: "a@example.com", name: "A", role: "ADMIN" } });
  });

  it("creates a product with prices in minor units and initial stock logged", async () => {
    const saved = await saveProduct(payload(), 2, "actor");
    const product = await prisma.product.findUniqueOrThrow({ where: { id: saved.id }, include: { variants: true } });
    expect(product.slug).toBe("concrete-candle-jar");
    expect(product.variants[0].price).toBe(1800);
    expect(product.variants[0].costPrice).toBe(650);
    expect(product.priceMin).toBe(1800);
    expect(product.inStock).toBe(true);
    expect(product.publishedAt).not.toBeNull();
    expect(await prisma.inventoryMovement.count({ where: { variantId: product.variants[0].id, reason: "RESTOCK" } })).toBe(1);
  });

  it("builds variants from options and validates them", async () => {
    const options = [
      { name: "Size", values: ["Small", "Large"] },
      { name: "Scent", values: ["Oud", "Fig"] },
    ];
    const variants = [
      ["Small", "Oud"],
      ["Small", "Fig"],
      ["Large", "Oud"],
      ["Large", "Fig"],
    ].map(([a, b], i) => ({ option1: a, option2: b, option3: null, sku: `V-${i}`, price: a === "Small" ? "18" : "26", salePrice: null, costPrice: null, stock: 2, stockAdjustment: 0, isActive: true }));
    const saved = await saveProduct(payload({ options, variants }), 2, "actor");
    const product = await prisma.product.findUniqueOrThrow({ where: { id: saved.id }, include: { variants: { orderBy: { position: "asc" } } } });
    expect(product.variants.map((v) => v.title)).toEqual(["Small / Oud", "Small / Fig", "Large / Oud", "Large / Fig"]);
    expect(product.priceMin).toBe(1800);
    expect(product.priceMax).toBe(2600);

    await expect(saveProduct(payload({ options, variants: variants.slice(0, 1).map((v) => ({ ...v, option2: "Vanilla" })) }), 2, "actor")).rejects.toBeInstanceOf(ProductValidationError);
  });

  it("rejects a sale price that isn't lower, and duplicate SKUs across products", async () => {
    await expect(saveProduct(payload({ variants: [{ option1: null, option2: null, option3: null, sku: null, price: "10", salePrice: "12", costPrice: null, stock: 0, stockAdjustment: 0, isActive: true }] }), 2, "actor")).rejects.toBeInstanceOf(ProductValidationError);
    await saveProduct(payload(), 2, "actor");
    await expect(saveProduct(payload({ name: "Another" }), 2, "actor")).rejects.toThrow(/JAR-1/);
  });

  it("changes existing stock only through logged adjustments", async () => {
    const saved = await saveProduct(payload(), 2, "actor");
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { productId: saved.id } });
    // Simulate a sale happening while the editor was open.
    await prisma.productVariant.update({ where: { id: variant.id }, data: { stock: { decrement: 3 } } });
    await saveProduct(payload({ id: saved.id, variants: [{ id: variant.id, option1: null, option2: null, option3: null, sku: "JAR-1", price: "18", salePrice: null, costPrice: null, stock: 999, stockAdjustment: 5, isActive: true }] }), 2, "actor");
    const after = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(after.stock).toBe(12); // 10 − 3 sold + 5 adjustment; the stale "999" is ignored
    expect(await prisma.inventoryMovement.count({ where: { variantId: variant.id, reason: "MANUAL_ADJUSTMENT" } })).toBe(1);
  });

  it("duplicates a product as a draft without SKUs or stock", async () => {
    const saved = await saveProduct(payload(), 2, "actor");
    const copy = await duplicateProduct(saved.id);
    const product = await prisma.product.findUniqueOrThrow({ where: { id: copy.id }, include: { variants: true } });
    expect(product.status).toBe("DRAFT");
    expect(product.slug).toBe("concrete-candle-jar-copy");
    expect(product.variants[0].sku).toBeNull();
    expect(product.variants[0].stock).toBe(0);
    expect(product.variants[0].price).toBe(1800);
  });
});
