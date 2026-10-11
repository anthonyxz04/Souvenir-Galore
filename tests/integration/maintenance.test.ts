import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { runCleanup } from "@/lib/maintenance";
import { hasDatabase, resetDatabase } from "./helpers";

const DAY = 86_400_000;

describe.skipIf(!hasDatabase)("daily cleanup (real database)", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("removes only expired or abandoned records", async () => {
    const now = Date.now();
    const user = await prisma.user.create({ data: { email: "keep@example.com", name: "Keep" } });
    await prisma.session.createMany({
      data: [
        { id: "expired", userId: user.id, expiresAt: new Date(now - 1000) },
        { id: "active", userId: user.id, expiresAt: new Date(now + DAY) },
      ],
    });
    await prisma.authToken.createMany({
      data: [
        { tokenHash: "used", type: "PASSWORD_RESET", userId: user.id, expiresAt: new Date(now + DAY), usedAt: new Date(now) },
        { tokenHash: "valid", type: "PASSWORD_RESET", userId: user.id, expiresAt: new Date(now + DAY) },
      ],
    });
    const oldGuest = await prisma.cart.create({ data: { guestTokenHash: "old" } });
    await prisma.cart.create({ data: { guestTokenHash: "recent" } });
    const userCart = await prisma.cart.create({ data: { userId: user.id } });
    await prisma.$executeRaw`UPDATE "Cart" SET "updatedAt" = ${new Date(now - 120 * DAY)} WHERE "id" IN (${oldGuest.id}, ${userCart.id})`;

    const result = await runCleanup(now);

    expect(result.sessions).toBe(1);
    expect(result.tokens).toBe(1);
    expect(result.guestCarts).toBe(1);
    expect(await prisma.session.findUnique({ where: { id: "active" } })).not.toBeNull();
    expect(await prisma.authToken.findUnique({ where: { tokenHash: "valid" } })).not.toBeNull();
    // Signed-in customers' carts are kept however old they are.
    expect(await prisma.cart.findUnique({ where: { id: userCart.id } })).not.toBeNull();
    expect(await prisma.user.count()).toBe(1);
  });
});
