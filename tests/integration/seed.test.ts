import { execSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { canEnable } from "@/lib/payments/rules";
import { hasDatabase, resetDatabase } from "./helpers";

describe.skipIf(!hasDatabase)("database seed (real database)", () => {
  beforeAll(async () => {
    await resetDatabase();
    execSync("npx tsx prisma/seed.ts", { env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL }, stdio: "pipe" });
  });

  it("creates every payment method switched off — Whish Money included", async () => {
    const methods = await prisma.paymentMethod.findMany();
    expect(methods.length).toBeGreaterThanOrEqual(3);
    expect(methods.every((m) => !m.isEnabled)).toBe(true);
    const whish = methods.find((m) => m.type === "WHISH_MONEY");
    expect(whish).toBeDefined();
    expect(whish?.config).toEqual({});
    expect(canEnable({ ...whish!, config: {} })).toBe(false);
  });

  it("creates inactive delivery areas and no administrator", async () => {
    expect(await prisma.deliveryZone.count({ where: { isActive: true } })).toBe(0);
    expect(await prisma.user.count()).toBe(0);
  });

  it("creates the five starting categories with subcategories", async () => {
    const top = await prisma.category.findMany({ where: { parentId: null }, include: { _count: { select: { children: true } } } });
    expect(top.map((c) => c.slug).sort()).toEqual(["candles-and-home-fragrance", "home-decor-and-art", "personalized-gifts", "religious-souvenirs", "seasonal-and-special"]);
    expect(top.every((c) => c._count.children > 0)).toBe(true);
  });

  it("marks policy pages for owner review and creates no reviews or products", async () => {
    expect(await prisma.page.count({ where: { needsOwnerReview: false } })).toBe(0);
    expect(await prisma.review.count()).toBe(0);
    expect(await prisma.product.count()).toBe(0);
  });

  it("can run twice without duplicating data", async () => {
    const before = await prisma.category.count();
    execSync("npx tsx prisma/seed.ts", { env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL }, stdio: "pipe" });
    expect(await prisma.category.count()).toBe(before);
  });
});
