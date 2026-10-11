/**
 * Homepage sections, managed in Admin → Homepage. Each section type has a small
 * Zod-validated config. Sections with nothing to show (e.g. testimonials before
 * any real reviews are approved) are skipped automatically.
 */

import { z } from "zod";
import type { HomeSectionType, Prisma } from "@prisma/client";
import { prisma } from "../db";
import { getProductCards, getProductCardsByIds, type ProductCardData } from "../catalog/queries";

export const productGridConfigSchema = z.object({
  source: z.enum(["bestsellers", "new", "featured", "sale", "personalizable", "collection", "category", "manual"]).default("featured"),
  collectionId: z.string().nullable().default(null),
  categoryId: z.string().nullable().default(null),
  productIds: z.array(z.string()).max(24).default([]),
  limit: z.number().int().min(2).max(12).default(8),
});

export const categoryGridConfigSchema = z.object({
  categoryIds: z.array(z.string()).max(12).default([]),
});

export const featuredCollectionsConfigSchema = z.object({
  collectionIds: z.array(z.string()).max(6).default([]),
  limit: z.number().int().min(1).max(6).default(3),
});

export const SECTION_TYPE_INFO: Record<HomeSectionType, { label: string; description: string }> = {
  HERO: { label: "Hero", description: "Large opening section with headline, buttons, image and the name-tag preview." },
  CATEGORY_GRID: { label: "Shop by category", description: "Category tiles with images." },
  FEATURED_COLLECTIONS: { label: "Featured collections", description: "Seasonal or occasion collections." },
  PRODUCT_GRID: { label: "Product row", description: "Bestsellers, new arrivals, a collection, or hand-picked products." },
  PROMO_BANNER: { label: "Promotional banner", description: "A wide banner for a sale or launch. Can be scheduled." },
  CRAFTSMANSHIP: { label: "Craftsmanship story", description: "Image and text about how pieces are made." },
  PERSONALIZATION_STEPS: { label: "How personalization works", description: "Short numbered steps explaining custom orders." },
  TESTIMONIALS: { label: "Customer reviews", description: "Shows approved reviews you mark as featured. Hidden when there are none." },
  INSTAGRAM: { label: "Instagram", description: "Selected photos linking to your Instagram." },
  NEWSLETTER: { label: "Newsletter signup", description: "Email signup with consent." },
};

const mediaSelect = { key: true, renditions: true, width: true, height: true, alt: true } satisfies Prisma.MediaAssetSelect;

async function resolveProducts(config: z.infer<typeof productGridConfigSchema>): Promise<ProductCardData[]> {
  const take = config.limit;
  switch (config.source) {
    case "bestsellers":
      return getProductCards({}, { take, orderBy: [{ isBestseller: "desc" }, { salesCount: "desc" }, { publishedAt: "desc" }] });
    case "new":
      return getProductCards({}, { take, orderBy: [{ publishedAt: "desc" }] });
    case "sale":
      return getProductCards({ salePriceMin: { not: null } }, { take });
    case "personalizable":
      return getProductCards({ personalizationFields: { some: {} } }, { take });
    case "collection":
      return config.collectionId ? getProductCards({ collections: { some: { collectionId: config.collectionId } } }, { take }) : [];
    case "category":
      return config.categoryId ? getProductCards({ categories: { some: { categoryId: config.categoryId } } }, { take }) : [];
    case "manual":
      return getProductCardsByIds(config.productIds.slice(0, take));
    default:
      return getProductCards({ isFeatured: true }, { take });
  }
}

export async function getHomeSections() {
  const now = new Date();
  const sections = await prisma.homeSection.findMany({
    where: {
      isVisible: true,
      AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
    orderBy: { position: "asc" },
    include: {
      image: { select: mediaSelect },
      items: { orderBy: { position: "asc" }, include: { image: { select: mediaSelect } } },
    },
  });

  const resolved = await Promise.all(
    sections.map(async (section) => {
      const config = (section.config ?? {}) as Record<string, unknown>;
      switch (section.type) {
        case "PRODUCT_GRID": {
          const parsed = productGridConfigSchema.parse(config);
          const products = await resolveProducts(parsed);
          return products.length ? { section, kind: "products" as const, products, config: parsed } : null;
        }
        case "CATEGORY_GRID": {
          const parsed = categoryGridConfigSchema.parse(config);
          const categories = await prisma.category.findMany({
            where: parsed.categoryIds.length ? { id: { in: parsed.categoryIds }, isPublished: true } : { parentId: null, isPublished: true },
            orderBy: [{ position: "asc" }, { name: "asc" }],
            take: 8,
            select: { id: true, name: true, slug: true, description: true, image: { select: mediaSelect } },
          });
          if (parsed.categoryIds.length) categories.sort((a, b) => parsed.categoryIds.indexOf(a.id) - parsed.categoryIds.indexOf(b.id));
          return categories.length ? { section, kind: "categories" as const, categories } : null;
        }
        case "FEATURED_COLLECTIONS": {
          const parsed = featuredCollectionsConfigSchema.parse(config);
          const collections = await prisma.collection.findMany({
            where: {
              isPublished: true,
              ...(parsed.collectionIds.length ? { id: { in: parsed.collectionIds } } : { isFeatured: true }),
              AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
            },
            orderBy: [{ position: "asc" }],
            take: parsed.limit,
            select: {
              id: true,
              name: true,
              slug: true,
              description: true,
              kind: true,
              image: { select: mediaSelect },
              products: {
                where: { product: { status: "ACTIVE" } },
                orderBy: { position: "asc" },
                take: 1,
                select: { product: { select: { images: { orderBy: { position: "asc" }, take: 1, select: { asset: { select: mediaSelect } } } } } },
              },
            },
          });
          return collections.length ? { section, kind: "collections" as const, collections } : null;
        }
        case "TESTIMONIALS": {
          const reviews = await prisma.review.findMany({
            where: { status: "APPROVED", isFeatured: true },
            orderBy: { createdAt: "desc" },
            take: 6,
            select: { id: true, authorName: true, rating: true, title: true, body: true, verifiedPurchase: true, product: { select: { name: true, slug: true } } },
          });
          return reviews.length ? { section, kind: "testimonials" as const, reviews } : null;
        }
        case "INSTAGRAM":
          return { section, kind: "instagram" as const };
        default:
          return { section, kind: "basic" as const };
      }
    }),
  );

  return resolved.filter((entry): entry is NonNullable<typeof entry> => entry !== null);
}

export type HomeSectionEntry = Awaited<ReturnType<typeof getHomeSections>>[number];
