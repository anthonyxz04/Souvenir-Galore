/**
 * The optional sample catalog: 12 clearly labelled demo products (SKUs start
 * with "DEMO-", descriptions say they are samples, images are illustrations).
 * Used by the dashboard buttons ("Add sample products" / "Remove sample
 * products") and by `npm run db:demo` / `npm run db:demo:remove`.
 *
 * Products are created one at a time so each request stays short on
 * serverless hosts. No reviews, orders or sales figures are ever created.
 */

import sharp from "sharp";
import { prisma } from "./db";
import { storeImage, deleteAssetFiles } from "./storage/images";
import { syncProductDerived } from "./catalog/sync";
import { slugify } from "./text";
import { normalizePreview3d, parsePreview3d, productChoices } from "./candle3d/config";
import { DEMO_NOTE, PRODUCTS } from "../../prisma/demo/products";

export const DEMO_SKU_PREFIX = "DEMO-";
export const DEMO_PRODUCT_COUNT = PRODUCTS.length;

function skuPrefix(index: number) {
  return `${DEMO_SKU_PREFIX}${String(index + 1).padStart(2, "0")}-`;
}

export async function countDemoProducts(): Promise<number> {
  return prisma.product.count({ where: { status: { not: "ARCHIVED" }, variants: { some: { sku: { startsWith: DEMO_SKU_PREFIX } } } } });
}

/** Creates demo product number `index` (0-based) unless it already exists. */
export async function addDemoProduct(index: number, uploadedById: string | null): Promise<{ created: boolean; name: string }> {
  const demo = PRODUCTS[index];
  if (!demo) throw new Error("No such sample product.");
  if (await prisma.productVariant.findFirst({ where: { sku: { startsWith: skuPrefix(index) } }, select: { id: true } })) {
    return { created: false, name: demo.name };
  }

  const assets = [];
  for (const [i, svg] of demo.images.entries()) {
    const buffer = await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
    assets.push(await storeImage({ buffer, originalName: `${demo.name} ${i + 1}.jpg`, prefix: "products", visibility: "PUBLIC", uploadedById, alt: demo.name }));
  }
  const categories = await prisma.category.findMany({ where: { slug: { in: demo.categories } }, select: { id: true } });
  const tagIds: string[] = [];
  for (const [groupSlug, tagSlugs] of Object.entries(demo.tags)) {
    const tags = await prisma.tag.findMany({ where: { slug: { in: tagSlugs }, group: { slug: groupSlug } }, select: { id: true } });
    tagIds.push(...tags.map((t) => t.id));
  }
  const collections = await prisma.collection.findMany({ where: { slug: { in: demo.collections ?? [] } }, select: { id: true } });

  let slug = slugify(demo.name);
  if (await prisma.product.findUnique({ where: { slug }, select: { id: true } })) slug = `${slug}-sample`;

  const combos: string[][] = demo.options?.length
    ? demo.options.reduce<string[][]>((acc, option) => acc.flatMap((combo) => option.values.map((value) => [...combo, value])), [[]])
    : [[]];
  const product = await prisma.product.create({
    data: {
      name: demo.name,
      slug,
      shortDescription: demo.short,
      description: demo.description + DEMO_NOTE,
      status: "ACTIVE",
      publishedAt: new Date(Date.now() - index * 2 * 86_400_000),
      pricingType: demo.quote ? "QUOTE" : "FIXED",
      isFeatured: Boolean(demo.featured),
      isBestseller: Boolean(demo.bestseller),
      isLimitedEdition: Boolean(demo.limited),
      trackInventory: demo.track ?? true,
      madeToOrder: Boolean(demo.madeToOrder),
      prepTimeMinDays: demo.prep?.[0] ?? null,
      prepTimeMaxDays: demo.prep?.[1] ?? null,
      preview3d: demo.preview3d
        ? normalizePreview3d(
            parsePreview3d(demo.preview3d),
            productChoices({ options: demo.options ?? [], personalizationFields: (demo.personalization ?? []).map((f) => ({ label: f.label, type: f.type, options: f.options ?? [] })) }),
          )
        : undefined,
      options: demo.options ? { create: demo.options.map((o, position) => ({ name: o.name, values: o.values, position })) } : undefined,
      variants: {
        create: combos.map((combo, position) => ({
          title: combo.length ? combo.join(" / ") : "Default",
          option1: combo[0] ?? null,
          option2: combo[1] ?? null,
          option3: combo[2] ?? null,
          sku: `${skuPrefix(index)}${position + 1}`,
          price: demo.variantPrices?.[combo[0] ?? ""] ?? demo.price ?? 0,
          salePrice: demo.salePrice ?? null,
          stock: demo.stock ?? 0,
          position,
        })),
      },
      images: { create: assets.map((asset, position) => ({ assetId: asset.id, alt: `${demo.name}, illustration ${position + 1}`, position })) },
      personalizationFields: demo.personalization
        ? {
            create: demo.personalization.map((field, position) => ({
              label: field.label,
              type: field.type,
              isRequired: field.isRequired,
              maxLength: field.maxLength ?? null,
              priceDelta: field.priceDelta ?? 0,
              options: field.options ?? [],
              placeholder: field.placeholder ?? null,
              position,
            })),
          }
        : undefined,
      categories: { create: categories.map((c) => ({ categoryId: c.id })) },
      tags: { create: tagIds.map((tagId) => ({ tagId })) },
      collections: { create: collections.map((c, position) => ({ collectionId: c.id, position })) },
    },
  });
  await syncProductDerived(product.id);
  return { created: true, name: demo.name };
}

/** Deletes every demo product and its images; demo products that appear in orders are archived instead. */
export async function removeDemoCatalog(): Promise<{ deleted: number; archived: number }> {
  const products = await prisma.product.findMany({
    where: { variants: { some: { sku: { startsWith: DEMO_SKU_PREFIX } } } },
    include: { images: { include: { asset: true } }, _count: { select: { orderItems: true } } },
  });
  let deleted = 0;
  let archived = 0;
  for (const product of products) {
    if (product._count.orderItems > 0) {
      if (product.status !== "ARCHIVED") {
        await prisma.product.update({ where: { id: product.id }, data: { status: "ARCHIVED" } });
        archived += 1;
      }
      continue;
    }
    const assets = product.images.map((image) => image.asset);
    await prisma.product.delete({ where: { id: product.id } });
    for (const asset of assets) {
      if (await prisma.productImage.count({ where: { assetId: asset.id } })) continue;
      await deleteAssetFiles(asset).catch(() => undefined);
      await prisma.mediaAsset.delete({ where: { id: asset.id } }).catch(() => undefined);
    }
    deleted += 1;
  }
  return { deleted, archived };
}
