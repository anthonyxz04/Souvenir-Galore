/**
 * Create / update products from the admin editor. One transaction updates the
 * product, options, variants, personalization fields, images and taxonomy.
 * Stock for existing variants changes only through explicit adjustments, which
 * are logged as inventory movements (so a save never overwrites sales that
 * happened while the editor was open).
 */

import { z } from "zod";
import { prisma } from "../db";
import { PERSONALIZATION_FIELD_TYPES, PRODUCT_STATUSES } from "../domain";
import { parseMoney } from "../money";
import { isValidSlug, slugify } from "../text";
import { syncProductDerived } from "./sync";
import { variantCombinations, variantTitle } from "./pricing";
import { normalizePreview3d, preview3dSchema, productChoices } from "../candle3d/config";

export class ProductValidationError extends Error {
  constructor(message: string, public readonly fieldErrors: Record<string, string> = {}) {
    super(message);
  }
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));
const optionalInt = (min: number, max: number) => z.number().int().min(min).max(max).nullish().transform((v) => (v === undefined ? null : v));

export const productPayloadSchema = z.object({
  id: z.string().max(40).optional(),
  name: z.string().trim().min(1, "Enter a product name.").max(200),
  slug: optionalText(100),
  shortDescription: optionalText(300),
  description: optionalText(20_000),
  status: z.enum(PRODUCT_STATUSES),
  pricingType: z.enum(["FIXED", "QUOTE"]),
  isFeatured: z.boolean(),
  isBestseller: z.boolean(),
  isLimitedEdition: z.boolean(),
  trackInventory: z.boolean(),
  allowBackorder: z.boolean(),
  madeToOrder: z.boolean(),
  allowInquiry: z.boolean(),
  lowStockThreshold: optionalInt(0, 10_000),
  prepTimeMinDays: optionalInt(0, 365),
  prepTimeMaxDays: optionalInt(0, 365),
  maxPerOrder: optionalInt(1, 10_000),
  saleStartsAt: optionalText(40),
  saleEndsAt: optionalText(40),
  seoTitle: optionalText(70),
  seoDescription: optionalText(170),
  options: z
    .array(
      z.object({
        name: z.string().trim().min(1, "Name the option.").max(40),
        values: z.array(z.string().trim().min(1).max(60)).min(1, "Add at least one value.").max(30),
      }),
    )
    .max(3),
  variants: z
    .array(
      z.object({
        id: z.string().max(40).optional(),
        option1: optionalText(60),
        option2: optionalText(60),
        option3: optionalText(60),
        sku: optionalText(64),
        price: z.string().max(20),
        salePrice: optionalText(20),
        costPrice: optionalText(20),
        stock: z.number().int().min(-100_000).max(1_000_000).default(0),
        stockAdjustment: z.number().int().min(-1_000_000).max(1_000_000).default(0),
        isActive: z.boolean(),
      }),
    )
    .min(1)
    .max(150),
  personalizationFields: z
    .array(
      z.object({
        id: z.string().max(40).optional(),
        label: z.string().trim().min(1, "Give the field a label.").max(60),
        type: z.enum(PERSONALIZATION_FIELD_TYPES),
        isRequired: z.boolean(),
        maxLength: optionalInt(1, 500),
        options: z.array(z.string().trim().min(1).max(60)).max(30),
        priceDelta: optionalText(20),
        placeholder: optionalText(100),
        helpText: optionalText(200),
      }),
    )
    .max(10),
  images: z.array(z.object({ assetId: z.string().max(40), alt: optionalText(200) })).max(20),
  categoryIds: z.array(z.string().max(40)).max(30),
  collectionIds: z.array(z.string().max(40)).max(30),
  tagIds: z.array(z.string().max(40)).max(80),
  /** Left out by older clients: the saved 3D settings are then kept as they are. */
  preview3d: preview3dSchema.optional(),
});

export type ProductPayload = z.infer<typeof productPayloadSchema>;

function parseDate(value: string | null, field: string, errors: Record<string, string>): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    errors[field] = "Enter a valid date and time.";
    return null;
  }
  return date;
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  let candidate = base;
  for (let i = 2; i < 200; i += 1) {
    const existing = await prisma.product.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!existing || existing.id === excludeId) return candidate;
    candidate = `${base}-${i}`.slice(0, 100);
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function saveProduct(payload: ProductPayload, decimals: number, actorId: string) {
  const errors: Record<string, string> = {};

  // ── Money and dates ─────────────────────────────────────────
  const variants = payload.variants.map((variant, index) => {
    const price = parseMoney(variant.price, decimals);
    const salePrice = variant.salePrice ? parseMoney(variant.salePrice, decimals) : null;
    const costPrice = variant.costPrice ? parseMoney(variant.costPrice, decimals) : null;
    if (payload.pricingType === "FIXED") {
      if (price === null) errors[`variants.${index}.price`] = "Enter a price like 12.50.";
      else if (price <= 0 && payload.status === "ACTIVE" && variant.isActive) errors[`variants.${index}.price`] = "Active products need a price above zero.";
    }
    if (variant.salePrice && salePrice === null) errors[`variants.${index}.salePrice`] = "Enter a sale price like 9.99.";
    if (salePrice !== null && price !== null && salePrice >= price) errors[`variants.${index}.salePrice`] = "The sale price must be lower than the regular price.";
    if (variant.costPrice && costPrice === null) errors[`variants.${index}.costPrice`] = "Enter a cost like 4.20.";
    return { ...variant, priceMinor: price ?? 0, salePriceMinor: salePrice, costPriceMinor: costPrice };
  });

  const fields = payload.personalizationFields.map((field, index) => {
    const priceDelta = field.priceDelta ? parseMoney(field.priceDelta, decimals) : 0;
    if (field.priceDelta && priceDelta === null) errors[`personalizationFields.${index}.priceDelta`] = "Enter an amount like 2.00.";
    if (field.type === "SELECT" && field.options.length === 0) errors[`personalizationFields.${index}.options`] = "Add the choices for this list.";
    return { ...field, priceDeltaMinor: priceDelta ?? 0 };
  });

  const saleStartsAt = parseDate(payload.saleStartsAt, "saleStartsAt", errors);
  const saleEndsAt = parseDate(payload.saleEndsAt, "saleEndsAt", errors);
  if (saleStartsAt && saleEndsAt && saleEndsAt <= saleStartsAt) errors.saleEndsAt = "The sale must end after it starts.";
  if (payload.prepTimeMinDays !== null && payload.prepTimeMaxDays !== null && payload.prepTimeMaxDays < payload.prepTimeMinDays) {
    errors.prepTimeMaxDays = "The maximum must be at least the minimum.";
  }

  // ── Options ↔ variants consistency ──────────────────────────
  const options = payload.options.map((o) => ({ name: o.name, values: [...new Set(o.values)] }));
  const optionNames = options.map((o) => o.name.toLowerCase());
  if (new Set(optionNames).size !== optionNames.length) errors.options = "Each option needs a different name.";
  if (options.length === 0) {
    if (variants.length !== 1) errors.variants = "A product without options has exactly one variant.";
  } else {
    const valid = new Set(variantCombinations(options).map((combo) => combo.join("\u0000")));
    const seen = new Set<string>();
    variants.forEach((variant, index) => {
      const key = [variant.option1, variant.option2, variant.option3].slice(0, options.length).join("\u0000");
      if (!valid.has(key)) errors[`variants.${index}.price`] = "This variant doesn't match the option values. Regenerate variants.";
      if (seen.has(key)) errors.variants = "Two variants have the same options.";
      seen.add(key);
    });
  }
  const skus = variants.map((v) => v.sku).filter(Boolean) as string[];
  if (new Set(skus).size !== skus.length) errors.variants = "Each SKU must be unique.";

  // ── Slug ────────────────────────────────────────────────────
  const slugBase = payload.slug ? payload.slug.toLowerCase() : slugify(payload.name);
  if (payload.slug && !isValidSlug(slugBase)) errors.slug = "Use lowercase letters, numbers and hyphens only.";

  if (Object.keys(errors).length) throw new ProductValidationError("Check the highlighted fields.", errors);

  // ── References must exist ──────────────────────────────────
  const [categories, collections, tags, assets] = await Promise.all([
    prisma.category.findMany({ where: { id: { in: payload.categoryIds } }, select: { id: true } }),
    prisma.collection.findMany({ where: { id: { in: payload.collectionIds } }, select: { id: true } }),
    prisma.tag.findMany({ where: { id: { in: payload.tagIds } }, select: { id: true } }),
    prisma.mediaAsset.findMany({ where: { id: { in: payload.images.map((i) => i.assetId) }, visibility: "PUBLIC" }, select: { id: true } }),
  ]);
  const assetIds = new Set(assets.map((a) => a.id));
  const slug = await uniqueSlug(slugBase, payload.id);

  if (skus.length) {
    const clash = await prisma.productVariant.findFirst({
      where: { sku: { in: skus }, ...(payload.id ? { productId: { not: payload.id } } : {}) },
      select: { sku: true },
    });
    if (clash) throw new ProductValidationError(`SKU ${clash.sku} is already used by another product.`, { variants: `SKU ${clash.sku} is already in use.` });
  }

  const existing = payload.id
    ? await prisma.product.findUnique({ where: { id: payload.id }, select: { id: true, publishedAt: true, status: true } })
    : null;
  if (payload.id && !existing) throw new ProductValidationError("This product no longer exists.");

  const productData = {
    name: payload.name,
    slug,
    shortDescription: payload.shortDescription,
    description: payload.description,
    status: payload.status,
    pricingType: payload.pricingType,
    isFeatured: payload.isFeatured,
    isBestseller: payload.isBestseller,
    isLimitedEdition: payload.isLimitedEdition,
    trackInventory: payload.trackInventory,
    allowBackorder: payload.allowBackorder,
    madeToOrder: payload.madeToOrder,
    allowInquiry: payload.allowInquiry,
    lowStockThreshold: payload.lowStockThreshold,
    prepTimeMinDays: payload.prepTimeMinDays,
    prepTimeMaxDays: payload.prepTimeMaxDays,
    maxPerOrder: payload.maxPerOrder,
    saleStartsAt,
    saleEndsAt,
    seoTitle: payload.seoTitle,
    seoDescription: payload.seoDescription,
    ...(payload.preview3d
      ? {
          preview3d: normalizePreview3d(
            payload.preview3d,
            productChoices({ options, personalizationFields: payload.personalizationFields.map((f) => ({ label: f.label, type: f.type, options: f.options })) }),
          ),
        }
      : {}),
    publishedAt: payload.status === "ACTIVE" ? existing?.publishedAt ?? new Date() : existing?.publishedAt ?? null,
  };

  const productId = await prisma.$transaction(
    async (tx) => {
      const product = existing
        ? await tx.product.update({ where: { id: existing.id }, data: productData, select: { id: true } })
        : await tx.product.create({ data: productData, select: { id: true } });
      const id = product.id;

      // Options
      await tx.productOption.deleteMany({ where: { productId: id } });
      if (options.length) {
        await tx.productOption.createMany({ data: options.map((o, position) => ({ productId: id, name: o.name, values: o.values, position })) });
      }

      // Variants
      const current = await tx.productVariant.findMany({ where: { productId: id }, select: { id: true, stock: true, _count: { select: { orderItems: true } } } });
      const currentIds = new Set(current.map((v) => v.id));
      const keepIds = new Set<string>(variants.flatMap((v) => (v.id && currentIds.has(v.id) ? [v.id] : [])));
      // Remove variants that are gone first, so a new variant can reuse their SKU.
      for (const old of current) {
        if (keepIds.has(old.id)) continue;
        if (old._count.orderItems > 0) await tx.productVariant.update({ where: { id: old.id }, data: { isActive: false, sku: null, position: 999 } });
        else await tx.productVariant.delete({ where: { id: old.id } });
      }
      for (const [position, variant] of variants.entries()) {
        const optionValues = [variant.option1, variant.option2, variant.option3].map((v, i) => (i < options.length ? v : null));
        const data = {
          title: variantTitle(optionValues),
          option1: optionValues[0],
          option2: optionValues[1],
          option3: optionValues[2],
          sku: variant.sku,
          price: variant.priceMinor,
          salePrice: variant.salePriceMinor,
          costPrice: variant.costPriceMinor,
          isActive: variant.isActive,
          position,
        };
        if (variant.id && currentIds.has(variant.id)) {
          const updated = await tx.productVariant.update({
            where: { id: variant.id },
            data: { ...data, ...(variant.stockAdjustment ? { stock: { increment: variant.stockAdjustment } } : {}) },
            select: { stock: true },
          });
          if (variant.stockAdjustment) {
            await tx.inventoryMovement.create({
              data: { variantId: variant.id, delta: variant.stockAdjustment, stockAfter: updated.stock, reason: "MANUAL_ADJUSTMENT", actorId, note: "Adjusted in product editor" },
            });
          }
        } else {
          const created = await tx.productVariant.create({ data: { ...data, productId: id, stock: variant.stock }, select: { id: true } });
          if (variant.stock) {
            await tx.inventoryMovement.create({ data: { variantId: created.id, delta: variant.stock, stockAfter: variant.stock, reason: "RESTOCK", actorId, note: "Initial stock" } });
          }
        }
      }

      // Personalization fields
      const currentFields = await tx.personalizationField.findMany({ where: { productId: id }, select: { id: true } });
      const currentFieldIds = new Set(currentFields.map((f) => f.id));
      const keptFields = new Set<string>();
      for (const [position, field] of fields.entries()) {
        const data = {
          label: field.label,
          type: field.type,
          isRequired: field.isRequired,
          maxLength: field.maxLength,
          options: field.type === "SELECT" ? field.options : [],
          priceDelta: field.priceDeltaMinor,
          placeholder: field.placeholder,
          helpText: field.helpText,
          position,
        };
        if (field.id && currentFieldIds.has(field.id)) {
          keptFields.add(field.id);
          await tx.personalizationField.update({ where: { id: field.id }, data });
        } else {
          const created = await tx.personalizationField.create({ data: { ...data, productId: id }, select: { id: true } });
          keptFields.add(created.id);
        }
      }
      await tx.personalizationField.deleteMany({ where: { productId: id, id: { notIn: [...keptFields] } } });

      // Images (order = position; first is the primary image)
      await tx.productImage.deleteMany({ where: { productId: id } });
      const images = payload.images.filter((image) => assetIds.has(image.assetId));
      if (images.length) {
        await tx.productImage.createMany({ data: images.map((image, position) => ({ productId: id, assetId: image.assetId, alt: image.alt, position })) });
      }

      // Categories, collections, tags
      await tx.productCategory.deleteMany({ where: { productId: id } });
      if (categories.length) await tx.productCategory.createMany({ data: categories.map((c) => ({ productId: id, categoryId: c.id })) });

      const existingCollections = await tx.collectionProduct.findMany({ where: { productId: id } });
      const keepCollections = new Set(collections.map((c) => c.id));
      await tx.collectionProduct.deleteMany({ where: { productId: id, collectionId: { notIn: [...keepCollections] } } });
      for (const collection of collections) {
        if (existingCollections.some((c) => c.collectionId === collection.id)) continue;
        const last = await tx.collectionProduct.aggregate({ where: { collectionId: collection.id }, _max: { position: true } });
        await tx.collectionProduct.create({ data: { collectionId: collection.id, productId: id, position: (last._max.position ?? -1) + 1 } });
      }

      await tx.productTag.deleteMany({ where: { productId: id } });
      if (tags.length) await tx.productTag.createMany({ data: tags.map((t) => ({ productId: id, tagId: t.id })) });

      await syncProductDerived(id, tx);
      return id;
    },
    { timeout: 30_000, maxWait: 10_000 },
  );

  return { id: productId, slug, created: !existing };
}

/** Copy a product (as a draft) including variants, images, fields and taxonomy. SKUs are cleared. */
export async function duplicateProduct(productId: string) {
  const source = await prisma.product.findUnique({
    where: { id: productId },
    include: { options: true, variants: true, images: true, personalizationFields: true, categories: true, collections: true, tags: true },
  });
  if (!source) throw new ProductValidationError("Product not found.");
  const slug = await uniqueSlug(`${source.slug}-copy`.slice(0, 100));
  const {
    id: _id,
    createdAt: _c,
    updatedAt: _u,
    options,
    variants,
    images,
    personalizationFields,
    categories,
    collections,
    tags,
    salesCount: _s,
    ratingAvg: _ra,
    ratingCount: _rc,
    publishedAt: _p,
    preview3d,
    ...rest
  } = source;
  return prisma.$transaction(async (tx) => {
    const copy = await tx.product.create({
      data: {
        ...rest,
        preview3d: preview3d ?? undefined,
        name: `${source.name} (copy)`,
        slug,
        status: "DRAFT",
        publishedAt: null,
        options: { create: options.map(({ name, values, position }) => ({ name, values, position })) },
        variants: {
          create: variants
            .filter((v) => v.isActive || variants.length === 1)
            .map(({ title, option1, option2, option3, price, salePrice, costPrice, position, isActive }) => ({ title, option1, option2, option3, price, salePrice, costPrice, position, isActive, stock: 0, sku: null })),
        },
        images: { create: images.map(({ assetId, alt, position }) => ({ assetId, alt, position })) },
        personalizationFields: {
          create: personalizationFields.map(({ label, type, isRequired, maxLength, options: o, priceDelta, placeholder, helpText, position }) => ({
            label,
            type,
            isRequired,
            maxLength,
            options: o,
            priceDelta,
            placeholder,
            helpText,
            position,
          })),
        },
        categories: { create: categories.map(({ categoryId }) => ({ categoryId })) },
        collections: { create: collections.map(({ collectionId, position }) => ({ collectionId, position })) },
        tags: { create: tags.map(({ tagId }) => ({ tagId })) },
      },
      select: { id: true },
    });
    await syncProductDerived(copy.id, tx);
    return copy;
  });
}
