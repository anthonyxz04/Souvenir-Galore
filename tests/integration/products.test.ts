import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { duplicateProduct, productPayloadSchema, ProductValidationError, saveProduct, type ProductPayload } from "@/lib/catalog/product-admin";
import { hasDatabase, resetDatabase } from "./helpers";
import { parsePreview3d } from "@/lib/candle3d/config";
import { addDemoProduct } from "@/lib/demo-catalog";

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
  it("saves 3D preview settings in step with the product's choices", async () => {
    const options = [
      { name: "Jar color", values: ["Charcoal", "White"] },
      { name: "Size", values: ["Small", "Large"] },
    ];
    const variants = ["Charcoal", "White"].flatMap((color, i) =>
      ["Small", "Large"].map((size, j) => ({ option1: color, option2: size, option3: null, sku: `J-${i}${j}`, price: "18.00", salePrice: null, costPrice: null, stock: 1, stockAdjustment: 0, isActive: true })),
    );
    const personalizationFields = [{ label: "Name", type: "TEXT" as const, isRequired: false, maxLength: 16, options: [], priceDelta: null, placeholder: null, helpText: null }];
    const saved = await saveProduct(
      payload({
        options,
        variants,
        personalizationFields,
        preview3d: parsePreview3d({ enabled: true, shape: "tapered", bindings: { jarColor: "Jar color", size: "Size", lid: "Removed option", labelText: ["Name", "Gone"] }, jarColors: { Charcoal: "#111111", Old: "#222222" } }),
      }),
      2,
      "actor",
    );
    const stored = parsePreview3d((await prisma.product.findUniqueOrThrow({ where: { id: saved.id } })).preview3d);
    expect(stored.enabled).toBe(true);
    expect(stored.shape).toBe("tapered");
    expect(stored.bindings).toMatchObject({ jarColor: "Jar color", size: "Size", lid: "", labelText: ["Name"] });
    expect(stored.jarColors).toEqual({ Charcoal: "#111111", White: "#f2efea" }); // kept, suggested, stale value dropped
    expect(stored.sizes.Small).toBeLessThan(stored.sizes.Large);

    // Saving from an older editor that doesn't send 3D settings keeps them.
    const { preview3d: _omit, ...withoutPreview } = payload({ id: saved.id, options, variants, personalizationFields });
    await saveProduct(withoutPreview as ProductPayload, 2, "actor");
    expect(parsePreview3d((await prisma.product.findUniqueOrThrow({ where: { id: saved.id } })).preview3d).shape).toBe("tapered");

    // Duplicates keep the 3D settings.
    const copy = await duplicateProduct(saved.id);
    expect(parsePreview3d((await prisma.product.findUniqueOrThrow({ where: { id: copy.id } })).preview3d).enabled).toBe(true);
  });

  it("keeps personalization fields added in the editor", async () => {
    const field = (label: string, id?: string) => ({ id, label, type: "TEXT" as const, isRequired: false, maxLength: 16, options: [], priceDelta: "2.00", placeholder: null, helpText: null });
    const saved = await saveProduct(payload({ personalizationFields: [field("Name")] }), 2, "actor");
    const first = await prisma.personalizationField.findMany({ where: { productId: saved.id } });
    expect(first.map((f) => [f.label, f.priceDelta])).toEqual([["Name", 200]]);

    const variants = (await prisma.productVariant.findMany({ where: { productId: saved.id } })).map((v) => ({ id: v.id, option1: null, option2: null, option3: null, sku: v.sku, price: "18.00", salePrice: null, costPrice: null, stock: 0, stockAdjustment: 0, isActive: true }));
    await saveProduct(payload({ id: saved.id, variants, personalizationFields: [field("Name", first[0].id), field("Date")] }), 2, "actor");
    const second = await prisma.personalizationField.findMany({ where: { productId: saved.id }, orderBy: { position: "asc" } });
    expect(second.map((f) => f.label)).toEqual(["Name", "Date"]);
    expect(second[0].id).toBe(first[0].id);
  });

  it("sample candle comes with a working 3D setup", async () => {
    await prisma.category.create({ data: { name: "Concrete candle jars", slug: "concrete-candle-jars" } });
    await addDemoProduct(0, null);
    const product = await prisma.product.findFirstOrThrow({ where: { variants: { some: { sku: { startsWith: "DEMO-01-" } } } } });
    const config = parsePreview3d(product.preview3d);
    expect(config.enabled).toBe(true);
    expect(config.bindings).toMatchObject({ jarColor: "Jar color", waxColor: "Wax color", size: "Size", lid: "Lid", font: "Lettering", labelText: ["Name on the label"] });
    expect(Object.keys(config.jarColors).sort()).toEqual(["Charcoal", "Natural", "Terracotta", "White"]);
    expect(config.lids).toEqual({ "No lid": "none", Wood: "wood", Gold: "gold" });
    expect(config.fonts).toEqual({ Classic: "serif", Handwritten: "script", Modern: "sans" });
  });
});
