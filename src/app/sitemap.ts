import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { absoluteUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const [products, categories, collections, pages] = await Promise.all([
    prisma.product.findMany({ where: { status: "ACTIVE" }, select: { slug: true, updatedAt: true } }),
    prisma.category.findMany({ where: { isPublished: true }, select: { slug: true, updatedAt: true } }),
    prisma.collection.findMany({
      where: { isPublished: true, AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }] },
      select: { slug: true, updatedAt: true },
    }),
    prisma.page.findMany({ where: { isPublished: true }, select: { slug: true, updatedAt: true } }),
  ]);
  return [
    { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/shop"), changeFrequency: "daily", priority: 0.9 },
    { url: absoluteUrl("/collections"), changeFrequency: "weekly", priority: 0.7 },
    { url: absoluteUrl("/gifts"), changeFrequency: "weekly", priority: 0.6 },
    { url: absoluteUrl("/custom-order"), changeFrequency: "monthly", priority: 0.6 },
    { url: absoluteUrl("/contact"), changeFrequency: "monthly", priority: 0.4 },
    { url: absoluteUrl("/faq"), changeFrequency: "monthly", priority: 0.4 },
    ...products.map((p) => ({ url: absoluteUrl(`/products/${p.slug}`), lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...categories.map((c) => ({ url: absoluteUrl(`/category/${c.slug}`), lastModified: c.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...collections.map((c) => ({ url: absoluteUrl(`/collections/${c.slug}`), lastModified: c.updatedAt, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...pages.map((p) => ({ url: absoluteUrl(p.slug === "about" ? "/about" : `/pages/${p.slug}`), lastModified: p.updatedAt, changeFrequency: "yearly" as const, priority: 0.3 })),
  ];
}
