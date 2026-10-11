import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { E2E } from "./data";

/** Resets the test database and creates the accounts and catalog the specs use. */
export default async function globalSetup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("Set TEST_DATABASE_URL to run end-to-end tests.");
  const env = { ...process.env, DATABASE_URL: url };
  execSync("npx prisma db push --force-reset --skip-generate --accept-data-loss", { env, stdio: "inherit" });
  execSync("npx tsx prisma/seed.ts", { env, stdio: "inherit" });
  execSync("npx tsx scripts/create-admin.ts", { env: { ...env, ADMIN_EMAIL: E2E.owner.email, ADMIN_NAME: E2E.owner.name, ADMIN_PASSWORD: E2E.owner.password }, stdio: "inherit" });

  const prisma = new PrismaClient({ datasourceUrl: url });
  try {
    // Make the store able to take orders: one delivery area, cash on delivery, pickup.
    await prisma.deliveryZone.updateMany({ where: { name: "Beirut" }, data: { isActive: true, fee: 300, minDays: 1, maxDays: 2 } });
    await prisma.paymentMethod.update({ where: { code: "cash-on-delivery" }, data: { isEnabled: true } });
    await prisma.discount.create({ data: { code: E2E.discountCode, type: "PERCENTAGE", value: 10, description: "E2E test code" } });
    await prisma.setting.upsert({ where: { key: "pickup" }, create: { key: "pickup", value: { enabled: true, locationName: "Test workshop" } }, update: { value: { enabled: true, locationName: "Test workshop" } } });

    const category = await prisma.category.findFirstOrThrow({ where: { slug: "concrete-candle-jars" } });
    await prisma.product.create({
      data: {
        name: E2E.product.name,
        slug: E2E.product.slug,
        shortDescription: "A hand-cast concrete candle for end-to-end tests.",
        status: "ACTIVE",
        publishedAt: new Date(),
        trackInventory: true,
        variants: { create: { title: "Default", price: 1800, stock: 50, sku: "E2E-1" } },
        personalizationFields: { create: { label: "Name", type: "TEXT", isRequired: false, maxLength: 16, priceDelta: 200 } },
        categories: { create: { categoryId: category.id } },
        priceMin: 1800,
        priceMax: 1800,
        inStock: true,
      },
    });
    await prisma.product.create({
      data: {
        name: E2E.limitedProduct.name,
        slug: E2E.limitedProduct.slug,
        status: "ACTIVE",
        publishedAt: new Date(),
        trackInventory: true,
        variants: { create: { title: "Default", price: 4500, stock: 1, sku: "E2E-2" } },
        priceMin: 4500,
        priceMax: 4500,
        inStock: true,
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}
