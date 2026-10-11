import { describe, expect, it } from "vitest";
import { hashPassword, needsRehash, passwordPolicyError, verifyPassword } from "@/lib/auth/password";
import { assignableRoles, hasPermission, isStaffRole } from "@/lib/auth/permissions";
import { generateToken, hashIp, sha256 } from "@/lib/auth/crypto";
import { safeRedirectPath } from "@/lib/text";

describe("password hashing", () => {
  it("hashes and verifies passwords", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(hash).not.toContain("correct horse");
    expect(await verifyPassword(hash, "correct horse battery staple")).toBe(true);
    expect(await verifyPassword(hash, "wrong password!!")).toBe(false);
  });

  it("uses a unique salt per hash", async () => {
    const [a, b] = await Promise.all([hashPassword("same password 123"), hashPassword("same password 123")]);
    expect(a).not.toBe(b);
  });

  it("rejects malformed hashes", async () => {
    expect(await verifyPassword("not-a-hash", "anything")).toBe(false);
    expect(await verifyPassword("scrypt$99$8$1$aaa$bbb", "anything")).toBe(false);
    expect(needsRehash("not-a-hash")).toBe(true);
  });
});

describe("password policy", () => {
  it("enforces length and common-password rules", () => {
    expect(passwordPolicyError("short")).toMatch(/at least 10/);
    expect(passwordPolicyError("password123")).toMatch(/too common/);
    expect(passwordPolicyError("aaaaaaaaaaaa")).toMatch(/repeated/);
    expect(passwordPolicyError("maya.khoury-candles", { email: "maya.khoury@example.com" })).toMatch(/email/);
    expect(passwordPolicyError("lavender-oud-2026")).toBeNull();
  });
});

describe("permissions", () => {
  it("gives customers no admin access", () => {
    expect(hasPermission("CUSTOMER", "dashboard:view")).toBe(false);
    expect(isStaffRole("CUSTOMER")).toBe(false);
  });

  it("limits staff to day-to-day operations", () => {
    expect(hasPermission("STAFF", "orders:manage")).toBe(true);
    expect(hasPermission("STAFF", "payment-methods:manage")).toBe(false);
    expect(hasPermission("STAFF", "payments:verify")).toBe(false);
    expect(hasPermission("STAFF", "settings:manage")).toBe(false);
  });

  it("reserves staff management for owners", () => {
    expect(hasPermission("ADMIN", "payment-methods:manage")).toBe(true);
    expect(hasPermission("ADMIN", "staff:manage")).toBe(false);
    expect(hasPermission("OWNER", "staff:manage")).toBe(true);
    expect(assignableRoles("ADMIN")).toEqual([]);
  });
});

describe("tokens and redirects", () => {
  it("generates unguessable tokens and hashes them", () => {
    const token = generateToken();
    expect(token.length).toBeGreaterThanOrEqual(43);
    expect(generateToken()).not.toBe(token);
    expect(sha256(token)).toHaveLength(64);
  });

  it("pseudonymizes IP addresses", () => {
    expect(hashIp("203.0.113.5")).not.toContain("203.0.113.5");
    expect(hashIp("203.0.113.5")).toBe(hashIp("203.0.113.5"));
    expect(hashIp(null)).toBeNull();
  });

  it("prevents open redirects", () => {
    expect(safeRedirectPath("/account/orders")).toBe("/account/orders");
    expect(safeRedirectPath("https://evil.example")).toBe("/");
    expect(safeRedirectPath("//evil.example")).toBe("/");
    expect(safeRedirectPath("/\\evil.example")).toBe("/");
  });
});
