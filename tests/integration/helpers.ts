/**
 * Integration-test helpers. These tests run against a REAL PostgreSQL database
 * given by TEST_DATABASE_URL, which is reset before the suite. Never point it
 * at production data.
 */

import { execSync } from "node:child_process";
import { prisma } from "@/lib/db";

export const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);

let schemaReady = false;

export async function resetDatabase() {
  if (!hasDatabase) throw new Error("TEST_DATABASE_URL is not set");
  if (!schemaReady) {
    execSync("npx prisma db push --force-reset --skip-generate --accept-data-loss", {
      env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
      stdio: "pipe",
    });
    schemaReady = true;
    return;
  }
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length) {
    await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"public"."${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
  }
}

export async function createPaymentMethod(overrides: Partial<Parameters<typeof prisma.paymentMethod.create>[0]["data"]> = {}) {
  return prisma.paymentMethod.create({
    data: {
      code: `pm-${Math.random().toString(36).slice(2, 8)}`,
      type: "CASH_ON_DELIVERY",
      name: "Cash on delivery",
      isEnabled: true,
      availableForDelivery: true,
      availableForPickup: true,
      config: {},
      ...overrides,
    },
  });
}

export async function createZone(overrides: Partial<Parameters<typeof prisma.deliveryZone.create>[0]["data"]> = {}) {
  return prisma.deliveryZone.create({ data: { name: "Beirut", fee: 300, isActive: true, ...overrides } });
}

export async function createProduct(options: { price?: number; stock?: number; trackInventory?: boolean; allowBackorder?: boolean; personalization?: boolean; name?: string } = {}) {
  const name = options.name ?? `Candle ${Math.random().toString(36).slice(2, 7)}`;
  const product = await prisma.product.create({
    data: {
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      status: "ACTIVE",
      publishedAt: new Date(),
      trackInventory: options.trackInventory ?? true,
      allowBackorder: options.allowBackorder ?? false,
      variants: { create: { title: "Default", price: options.price ?? 2000, stock: options.stock ?? 10 } },
      personalizationFields: options.personalization
        ? { create: { label: "Name", type: "TEXT", isRequired: true, maxLength: 20, priceDelta: 250 } }
        : undefined,
    },
    include: { variants: true, personalizationFields: true },
  });
  return product;
}

export async function createCart(items: { variantId: string; quantity: number; personalization?: { fieldId: string; label: string; value: string; priceDelta: number }[] }[], userId?: string) {
  return prisma.cart.create({
    data: {
      userId: userId ?? null,
      guestTokenHash: userId ? null : `guest-${Math.random().toString(36).slice(2)}`,
      items: {
        create: items.map((item, index) => ({
          variantId: item.variantId,
          quantity: item.quantity,
          personalization: item.personalization ?? undefined,
          personalizationKey: item.personalization ? `p${index}` : "",
        })),
      },
    },
  });
}

export const baseOrderInput = {
  email: "customer@example.com",
  name: "Test Customer",
  phone: "+961 70 000 000",
  acceptTerms: true,
  customerNote: null,
};

export const actor = { id: "admin-actor", email: "admin@example.com", name: "Admin" };
