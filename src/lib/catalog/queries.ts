/**
 * Storefront read queries. Only ACTIVE products and published categories /
 * collections are ever returned here.
 */

import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { getSettings } from "../settings";
import type { MediaRef } from "../storage/urls";
import { priceRange, productBadges, type PriceRange } from "./pricing";

// ─────────────────────────────────────────────────────────────
// Product cards
// ─────────────────────────────────────────────────────────────

export const productCardSelect = {
  id: true,
  slug: true,
  name: true,
  shortDescription: true,
  pricingType: true,
  publishedAt: true,
  isBestseller: true,
  isLimitedEdition: true,
  madeToOrder: true,
  inStock: true,
  saleStartsAt: true,
  saleEndsAt: true,
  ratingAvg: true,
  ratingCount: true,
  images: {
    orderBy: { position: "asc" },
    take: 2,
    select: { alt: true, asset: { select: { key: true, renditions: true, width: true, height: true, alt: true } } },
  },
  variants: { where: { isActive: true }, select: { price: true, salePrice: true, isActive: true } },
  _count: { select: { personalizationFields: true } },
} satisfies Prisma.ProductSelect;

type CardRow = Prisma.ProductGetPayload<{ select: typeof productCardSelect }>;

export type ProductCardData = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  isQuote: boolean;
  image: (MediaRef & { alt: string }) | null;
  hoverImage: (MediaRef & { alt: string }) | null;
  price: PriceRange | null;
  badges: { key: string; label: string }[];
  personalizable: boolean;
  madeToOrder: boolean;
  ratingAvg: number;
  ratingCount: number;
};

function toMedia(image: CardRow["images"][number] | undefined, fallbackAlt: string) {
  if (!image) return null;
  return { ...image.asset, alt: image.alt || image.asset.alt || fallbackAlt };
}

export function toProductCard(row: CardRow, now: Date, newBadgeDays: number): ProductCardData {
  const price = priceRange(row.variants, row, now);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortDescription: row.shortDescription,
    isQuote: row.pricingType === "QUOTE",
    image: toMedia(row.images[0], row.name),
    hoverImage: toMedia(row.images[1], row.name),
    price,
    badges: productBadges(
      { ...row, onSale: Boolean(price?.onSale) && row.pricingType === "FIXED", inStock: row.inStock || row.pricingType === "QUOTE" },
      now,
      newBadgeDays,
    ),
    personalizable: row._count.personalizationFields > 0,
    madeToOrder: row.madeToOrder,
    ratingAvg: row.ratingAvg,
    ratingCount: row.ratingCount,
  };
}

async function cardContext() {
  const commerce = await getSettings("commerce");
  return { now: new Date(), newBadgeDays: commerce.newBadgeDays };
}

const ACTIVE: Prisma.ProductWhereInput = { status: "ACTIVE" };

function saleOpen(now: Date): Prisma.ProductWhereInput {
  return {
    salePriceMin: { not: null },
    AND: [
      { OR: [{ saleStartsAt: null }, { saleStartsAt: { lte: now } }] },
      { OR: [{ saleEndsAt: null }, { saleEndsAt: { gte: now } }] },
    ],
  };
}

// ─────────────────────────────────────────────────────────────
// Navigation & taxonomy
// ─────────────────────────────────────────────────────────────

export const getNavCategories = cache(async () => {
  return prisma.category.findMany({
    where: { parentId: null, isPublished: true, showInNav: true },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      children: {
        where: { isPublished: true, showInNav: true },
        orderBy: [{ position: "asc" }, { name: "asc" }],
        select: { id: true, name: true, slug: true },
      },
    },
  });
});

export const getPublishedCollections = cache(async () => {
  const now = new Date();
  return prisma.collection.findMany({
    where: {
      isPublished: true,
      AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      kind: true,
      isFeatured: true,
      image: { select: { key: true, renditions: true, width: true, height: true, alt: true } },
      _count: { select: { products: { where: { product: { status: "ACTIVE" } } } } },
    },
  });
});

/** Collect a category and all of its published descendants. */
async function categoryWithDescendants(rootId: string): Promise<string[]> {
  const all = await prisma.category.findMany({ where: { isPublished: true }, select: { id: true, parentId: true } });
  const ids = new Set([rootId]);
  let added = true;
  while (added) {
    added = false;
    for (const cat of all) {
      if (cat.parentId && ids.has(cat.parentId) && !ids.has(cat.id)) {
        ids.add(cat.id);
        added = true;
      }
    }
  }
  return [...ids];
}

export const getCategoryBySlug = cache(async (slug: string) => {
  return prisma.category.findFirst({
    where: { slug, isPublished: true },
    include: {
      parent: { select: { name: true, slug: true, parent: { select: { name: true, slug: true } } } },
      children: { where: { isPublished: true }, orderBy: [{ position: "asc" }, { name: "asc" }], select: { id: true, name: true, slug: true } },
      image: { select: { key: true, renditions: true, width: true, height: true, alt: true } },
    },
  });
});

export const getCollectionBySlug = cache(async (slug: string) => {
  const now = new Date();
  return prisma.collection.findFirst({
    where: {
      slug,
      isPublished: true,
      AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
    include: { image: { select: { key: true, renditions: true, width: true, height: true, alt: true } } },
  });
});

export const getFilterGroups = cache(async () => {
  const groups = await prisma.tagGroup.findMany({
    where: { isFilterable: true },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      tags: {
        orderBy: [{ position: "asc" }, { name: "asc" }],
        select: { id: true, name: true, slug: true, _count: { select: { products: { where: { product: { status: "ACTIVE" } } } } } },
      },
    },
  });
  return groups
    .map((group) => ({ ...group, tags: group.tags.filter((tag) => tag._count.products > 0) }))
    .filter((group) => group.tags.length > 0);
});

// ─────────────────────────────────────────────────────────────
// Listing with filters
// ─────────────────────────────────────────────────────────────

export const SORT_OPTIONS = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "popular", label: "Most popular" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
] as const;
export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

export type ProductListParams = {
  q?: string;
  categoryId?: string;
  collectionId?: string;
  /** group slug → selected tag slugs */
  tags?: Record<string, string[]>;
  minPrice?: number;
  maxPrice?: number;
  availability?: "in_stock" | "made_to_order";
  onSale?: boolean;
  personalizable?: boolean;
  sort?: SortValue;
  page?: number;
  perPage?: number;
};

export async function listProducts(params: ProductListParams) {
  const { now, newBadgeDays } = await cardContext();
  const perPage = Math.min(Math.max(params.perPage ?? 24, 1), 60);
  const page = Math.max(1, Math.floor(params.page ?? 1));
  const and: Prisma.ProductWhereInput[] = [ACTIVE];

  if (params.categoryId) {
    const ids = await categoryWithDescendants(params.categoryId);
    and.push({ categories: { some: { categoryId: { in: ids } } } });
  }
  if (params.collectionId) and.push({ collections: { some: { collectionId: params.collectionId } } });

  for (const [groupSlug, tagSlugs] of Object.entries(params.tags ?? {})) {
    if (tagSlugs.length === 0) continue;
    and.push({ tags: { some: { tag: { slug: { in: tagSlugs }, group: { slug: groupSlug } } } } });
  }

  const min = params.minPrice;
  const max = params.maxPrice;
  if (min !== undefined || max !== undefined) {
    const range = { ...(min !== undefined ? { gte: min } : {}), ...(max !== undefined ? { lte: max } : {}) };
    and.push({ OR: [{ priceMin: range }, { AND: [saleOpen(now), { salePriceMin: range }] }] });
    and.push({ pricingType: "FIXED" });
  }

  if (params.availability === "in_stock") and.push({ inStock: true, madeToOrder: false });
  if (params.availability === "made_to_order") and.push({ madeToOrder: true });
  if (params.onSale) and.push(saleOpen(now));
  if (params.personalizable) and.push({ personalizationFields: { some: {} } });

  const q = params.q?.trim().slice(0, 100);
  if (q) {
    and.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { shortDescription: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { tags: { some: { tag: { name: { contains: q, mode: "insensitive" } } } } },
        { categories: { some: { category: { name: { contains: q, mode: "insensitive" } } } } },
      ],
    });
  }

  const orderBy: Prisma.ProductOrderByWithRelationInput[] = (() => {
    switch (params.sort) {
      case "newest":
        return [{ publishedAt: "desc" }, { createdAt: "desc" }];
      case "popular":
        return [{ salesCount: "desc" }, { ratingCount: "desc" }, { publishedAt: "desc" }];
      case "price_asc":
        return [{ priceMin: "asc" }, { name: "asc" }];
      case "price_desc":
        return [{ priceMax: "desc" }, { name: "asc" }];
      default:
        return [{ isFeatured: "desc" }, { isBestseller: "desc" }, { salesCount: "desc" }, { publishedAt: "desc" }];
    }
  })();

  const where: Prisma.ProductWhereInput = { AND: and };
  const [total, rows] = await prisma.$transaction([
    prisma.product.count({ where }),
    prisma.product.findMany({ where, orderBy, skip: (page - 1) * perPage, take: perPage, select: productCardSelect }),
  ]);

  return {
    items: rows.map((row) => toProductCard(row, now, newBadgeDays)),
    total,
    page,
    perPage,
    pageCount: Math.max(1, Math.ceil(total / perPage)),
  };
}

export async function getProductCards(where: Prisma.ProductWhereInput, options: { take: number; orderBy?: Prisma.ProductOrderByWithRelationInput[] }) {
  const { now, newBadgeDays } = await cardContext();
  const rows = await prisma.product.findMany({
    where: { AND: [ACTIVE, where] },
    orderBy: options.orderBy ?? [{ isFeatured: "desc" }, { publishedAt: "desc" }],
    take: options.take,
    select: productCardSelect,
  });
  return rows.map((row) => toProductCard(row, now, newBadgeDays));
}

export async function getProductCardsByIds(ids: string[]) {
  if (ids.length === 0) return [];
  const cards = await getProductCards({ id: { in: ids.slice(0, 24) } }, { take: 24 });
  const order = new Map(ids.map((id, index) => [id, index]));
  return cards.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

// ─────────────────────────────────────────────────────────────
// Product detail
// ─────────────────────────────────────────────────────────────

export const getProductDetail = cache(async (slug: string, includeUnpublished = false) => {
  return prisma.product.findFirst({
    where: { slug, ...(includeUnpublished ? {} : ACTIVE) },
    include: {
      options: { orderBy: { position: "asc" } },
      variants: { where: { isActive: true }, orderBy: { position: "asc" } },
      images: {
        orderBy: { position: "asc" },
        include: { asset: { select: { key: true, renditions: true, width: true, height: true, alt: true } } },
      },
      personalizationFields: { orderBy: { position: "asc" } },
      categories: {
        include: { category: { select: { id: true, name: true, slug: true, isPublished: true, parent: { select: { name: true, slug: true } } } } },
      },
      collections: { include: { collection: { select: { id: true, name: true, slug: true, isPublished: true } } } },
      tags: { include: { tag: { select: { name: true, slug: true, group: { select: { name: true, slug: true } } } } } },
    },
  });
});

export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProductDetail>>>;

export async function getApprovedReviews(productId: string, take = 20) {
  return prisma.review.findMany({
    where: { productId, status: "APPROVED" },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, authorName: true, rating: true, title: true, body: true, verifiedPurchase: true, createdAt: true },
  });
}

export async function getRelatedProducts(product: { id: string; categories: { categoryId: string }[] }, take = 4) {
  const categoryIds = product.categories.map((c) => c.categoryId);
  const related = categoryIds.length
    ? await getProductCards(
        { id: { not: product.id }, categories: { some: { categoryId: { in: categoryIds } } } },
        { take, orderBy: [{ salesCount: "desc" }, { publishedAt: "desc" }] },
      )
    : [];
  if (related.length >= take) return related;
  const filler = await getProductCards(
    { id: { notIn: [product.id, ...related.map((r) => r.id)] } },
    { take: take - related.length, orderBy: [{ isBestseller: "desc" }, { publishedAt: "desc" }] },
  );
  return [...related, ...filler];
}

// ─────────────────────────────────────────────────────────────
// Search suggestions
// ─────────────────────────────────────────────────────────────

export async function searchSuggestions(query: string) {
  const q = query.trim().slice(0, 60);
  if (q.length < 2) return { products: [], categories: [] };
  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: {
        ...ACTIVE,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { tags: { some: { tag: { name: { contains: q, mode: "insensitive" } } } } },
        ],
      },
      orderBy: [{ salesCount: "desc" }, { name: "asc" }],
      take: 6,
      select: {
        slug: true,
        name: true,
        priceMin: true,
        pricingType: true,
        images: { orderBy: { position: "asc" }, take: 1, select: { asset: { select: { key: true, renditions: true } } } },
      },
    }),
    prisma.category.findMany({
      where: { isPublished: true, name: { contains: q, mode: "insensitive" } },
      take: 4,
      select: { name: true, slug: true },
    }),
  ]);
  return { products, categories };
}
