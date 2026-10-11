/**
 * Initial data for a new Souvenir Galore store. Safe to run more than once
 * (existing rows are left alone).
 *
 *   npm run db:seed
 *
 * Creates: starting categories, filter groups, collections (unpublished),
 * payment methods (ALL DISABLED), delivery areas (ALL INACTIVE, fee to be set),
 * homepage sections, and policy page templates flagged for owner review.
 *
 * It does NOT create an administrator (use `npm run admin:create`), products,
 * reviews or testimonials, and it never invents contact details, prices,
 * delivery fees or payment account numbers.
 */

import { PrismaClient } from "@prisma/client";
import { DEFAULT_PAYMENT_METHODS } from "../src/lib/payments/defaults";
import { slugify } from "../src/lib/text";
import { POLICY_PAGES } from "./seed-content/pages";
import { FAQ_ITEMS } from "./seed-content/faq";
import { CATEGORIES, COLLECTIONS, DELIVERY_AREAS, HOME_SECTIONS, TAG_GROUPS } from "./seed-content/catalog";

try {
  process.loadEnvFile?.();
} catch {
  /* no .env file — rely on the environment */
}

const prisma = new PrismaClient();

async function seedCategories() {
  if ((await prisma.category.count()) > 0) return console.log("· categories exist — skipped");
  for (const [position, category] of CATEGORIES.entries()) {
    const parent = await prisma.category.create({
      data: { name: category.name, slug: slugify(category.name), description: category.description, position, isPublished: true, showInNav: true },
    });
    for (const [childPosition, child] of category.children.entries()) {
      let slug = slugify(child);
      if (await prisma.category.findUnique({ where: { slug } })) slug = `${slugify(category.name, 30)}-${slug}`;
      await prisma.category.create({ data: { name: child, slug, parentId: parent.id, position: childPosition, isPublished: true, showInNav: true } });
    }
  }
  console.log("✓ categories");
}

async function seedTags() {
  for (const [position, group] of TAG_GROUPS.entries()) {
    const existing = await prisma.tagGroup.findUnique({ where: { slug: group.slug } });
    if (existing) continue;
    await prisma.tagGroup.create({
      data: {
        name: group.name,
        slug: group.slug,
        position,
        isFilterable: true,
        tags: { create: group.tags.map((name, tagPosition) => ({ name, slug: slugify(name, 60), position: tagPosition })) },
      },
    });
  }
  console.log("✓ filter groups");
}

async function seedCollections() {
  for (const [position, collection] of COLLECTIONS.entries()) {
    const slug = slugify(collection.name);
    if (await prisma.collection.findUnique({ where: { slug } })) continue;
    await prisma.collection.create({ data: { ...collection, slug, position, isPublished: false } });
  }
  console.log("✓ collections (unpublished)");
}

async function seedPaymentMethods() {
  for (const method of DEFAULT_PAYMENT_METHODS) {
    if (await prisma.paymentMethod.findUnique({ where: { code: method.code } })) continue;
    await prisma.paymentMethod.create({ data: { ...method, isEnabled: false } });
  }
  console.log("✓ payment methods (all disabled)");
}

async function seedDeliveryAreas() {
  if ((await prisma.deliveryZone.count()) > 0) return console.log("· delivery areas exist — skipped");
  await prisma.deliveryZone.createMany({
    data: DELIVERY_AREAS.map((name, position) => ({ name, fee: 0, isActive: false, position, description: null })),
  });
  console.log("✓ delivery areas (inactive — set fees before enabling)");
}

async function seedHomepage() {
  if ((await prisma.homeSection.count()) > 0) return console.log("· homepage sections exist — skipped");
  for (const [position, section] of HOME_SECTIONS.entries()) {
    const { items, isVisible = true, config = {}, ...rest } = section;
    await prisma.homeSection.create({
      data: { ...rest, config, isVisible, position, items: items ? { create: items.map((item, i) => ({ ...item, position: i })) } : undefined },
    });
  }
  console.log("✓ homepage sections");
}

async function seedPages() {
  for (const [position, page] of POLICY_PAGES.entries()) {
    if (await prisma.page.findUnique({ where: { slug: page.slug } })) continue;
    await prisma.page.create({ data: { ...page, position, needsOwnerReview: true } });
  }
  console.log("✓ policy pages (marked for owner review)");
}

async function seedFaq() {
  if ((await prisma.faqItem.count()) > 0) return console.log("· FAQ exists — skipped");
  await prisma.faqItem.createMany({ data: FAQ_ITEMS.map((item, position) => ({ ...item, position, isPublished: false })) });
  console.log("✓ FAQ drafts (unpublished — review and publish in the dashboard)");
}

async function main() {
  await seedCategories();
  await seedTags();
  await seedCollections();
  await seedPaymentMethods();
  await seedDeliveryAreas();
  await seedHomepage();
  await seedPages();
  await seedFaq();
  console.log("\nDone. Next: create your administrator with `npm run admin:create`.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
