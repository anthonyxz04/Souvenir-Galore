import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { AccountError, authenticate, consumeAuthToken, createUser, deleteCustomerAccount, issueAuthToken, resetPasswordWithToken } from "@/lib/auth/service";
import { checkLimit, clearLimit, isLimited, rateLimit } from "@/lib/rate-limit";
import { hasDatabase, resetDatabase } from "./helpers";

describe.skipIf(!hasDatabase)("accounts and security (real database)", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("stores only a password hash and rejects duplicate emails", async () => {
    const user = await createUser({ email: "Maya@Example.com", name: "Maya", password: "lavender-oud-2026" });
    expect(user.email).toBe("maya@example.com");
    expect(user.passwordHash).not.toContain("lavender");
    await expect(createUser({ email: "maya@example.com", name: "Other", password: "another-pass-123" })).rejects.toBeInstanceOf(AccountError);
  });

  it("enforces the password policy", async () => {
    await expect(createUser({ email: "a@example.com", name: "A", password: "short" })).rejects.toBeInstanceOf(AccountError);
  });

  it("authenticates correct credentials only, and blocks disabled accounts", async () => {
    await createUser({ email: "maya@example.com", name: "Maya", password: "lavender-oud-2026" });
    expect(await authenticate("MAYA@example.com", "lavender-oud-2026")).not.toBeNull();
    expect(await authenticate("maya@example.com", "wrong-password-1")).toBeNull();
    expect(await authenticate("nobody@example.com", "whatever-123456")).toBeNull();
    await prisma.user.update({ where: { email: "maya@example.com" }, data: { disabledAt: new Date() } });
    expect(await authenticate("maya@example.com", "lavender-oud-2026")).toBeNull();
  });

  it("uses single-use, expiring tokens", async () => {
    const user = await createUser({ email: "t@example.com", name: "T", password: "lavender-oud-2026" });
    const token = await issueAuthToken(user.id, "EMAIL_VERIFICATION");
    expect(await consumeAuthToken(token, "PASSWORD_RESET")).toBeNull();
    expect(await consumeAuthToken(token, "EMAIL_VERIFICATION")).toBe(user.id);
    expect(await consumeAuthToken(token, "EMAIL_VERIFICATION")).toBeNull();

    const expired = await issueAuthToken(user.id, "PASSWORD_RESET");
    await prisma.authToken.updateMany({ where: { userId: user.id, type: "PASSWORD_RESET" }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await consumeAuthToken(expired, "PASSWORD_RESET")).toBeNull();
  });

  it("issuing a new reset link invalidates the previous one", async () => {
    const user = await createUser({ email: "r@example.com", name: "R", password: "lavender-oud-2026" });
    const first = await issueAuthToken(user.id, "PASSWORD_RESET");
    await issueAuthToken(user.id, "PASSWORD_RESET");
    expect(await consumeAuthToken(first, "PASSWORD_RESET")).toBeNull();
  });

  it("resetting the password ends every session", async () => {
    const user = await createUser({ email: "s@example.com", name: "S", password: "lavender-oud-2026" });
    await prisma.session.create({ data: { id: "hash-1", userId: user.id, expiresAt: new Date(Date.now() + 86_400_000) } });
    const token = await issueAuthToken(user.id, "PASSWORD_RESET");
    await resetPasswordWithToken(token, "a-brand-new-passphrase");
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
    expect(await authenticate("s@example.com", "a-brand-new-passphrase")).not.toBeNull();
  });

  it("rate limits across calls with a database-backed counter", async () => {
    const results = [];
    for (let i = 0; i < 4; i += 1) results.push((await rateLimit("test:key", 3, 60)).ok);
    expect(results).toEqual([true, true, true, false]);
  });

  it("locks an account only after repeated wrong passwords, and a sign-in clears it", async () => {
    const email = "owner@example.com";
    expect(await isLimited("loginPerAccount", email)).toBe(false);
    for (let i = 0; i < 6; i += 1) await checkLimit("loginPerAccount", email); // six wrong passwords
    expect(await isLimited("loginPerAccount", email)).toBe(true);
    expect(await isLimited("loginPerAccount", email)).toBe(true); // checking doesn't count
    await clearLimit("loginPerAccount", email);
    expect(await isLimited("loginPerAccount", email)).toBe(false);
  });

  it("deletes customer accounts by removing personal data but keeping orders", async () => {
    const user = await createUser({ email: "del@example.com", name: "Del Customer", password: "lavender-oud-2026", phone: "70000000" });
    await prisma.address.create({ data: { userId: user.id, recipientName: "Del", phone: "70000000", line1: "Street", city: "Beirut" } });
    await deleteCustomerAccount(user.id);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.email).not.toContain("del@example.com");
    expect(after.passwordHash).toBeNull();
    expect(after.phone).toBeNull();
    expect(after.deletedAt).not.toBeNull();
    expect(await prisma.address.count({ where: { userId: user.id } })).toBe(0);
    expect(await authenticate("del@example.com", "lavender-oud-2026")).toBeNull();
  });
});
