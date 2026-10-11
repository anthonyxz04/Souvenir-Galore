/**
 * Account operations that don't depend on Next.js (testable against a database).
 * Cookie/session handling lives in session.ts and the Server Actions.
 */

import type { AuthTokenType, Role } from "@prisma/client";
import { prisma } from "../db";
import { normalizeEmail } from "../text";
import { generateToken, sha256 } from "./crypto";
import { dummyPasswordHash, hashPassword, needsRehash, passwordPolicyError, verifyPassword } from "./password";

export class AccountError extends Error {}

const TOKEN_TTL: Record<AuthTokenType, number> = {
  EMAIL_VERIFICATION: 24 * 60 * 60 * 1000,
  PASSWORD_RESET: 60 * 60 * 1000,
};

export async function createUser(input: {
  email: string;
  name: string;
  password: string;
  phone?: string | null;
  marketingOptIn?: boolean;
  role?: Role;
  emailVerified?: boolean;
}) {
  const email = normalizeEmail(input.email);
  const policy = passwordPolicyError(input.password, { email, name: input.name });
  if (policy) throw new AccountError(policy);
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) throw new AccountError("An account with this email already exists. Sign in or reset your password.");
  return prisma.user.create({
    data: {
      email,
      name: input.name.trim(),
      phone: input.phone?.trim() || null,
      passwordHash: await hashPassword(input.password),
      marketingOptIn: Boolean(input.marketingOptIn),
      role: input.role ?? "CUSTOMER",
      emailVerifiedAt: input.emailVerified ? new Date() : null,
    },
  });
}

/** Returns the user when the credentials are correct, otherwise null. Timing is similar either way. */
export async function authenticate(emailInput: string, password: string) {
  const email = normalizeEmail(emailInput);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash || user.deletedAt) {
    await verifyPassword(await dummyPasswordHash(), password);
    return null;
  }
  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) return null;
  if (user.disabledAt) return null;
  const updates: { lastLoginAt: Date; passwordHash?: string } = { lastLoginAt: new Date() };
  if (needsRehash(user.passwordHash)) updates.passwordHash = await hashPassword(password);
  await prisma.user.update({ where: { id: user.id }, data: updates });
  return user;
}

export async function issueAuthToken(userId: string, type: AuthTokenType): Promise<string> {
  const token = generateToken();
  await prisma.$transaction([
    prisma.authToken.deleteMany({ where: { userId, type, usedAt: null } }),
    prisma.authToken.create({
      data: { userId, type, tokenHash: sha256(token), expiresAt: new Date(Date.now() + TOKEN_TTL[type]) },
    }),
  ]);
  return token;
}

/** Marks a token as used (exactly once) and returns its user id, or null if invalid/expired/used. */
export async function consumeAuthToken(token: string, type: AuthTokenType): Promise<string | null> {
  if (!token || token.length > 200) return null;
  const tokenHash = sha256(token);
  const record = await prisma.authToken.findUnique({ where: { tokenHash } });
  if (!record || record.type !== type || record.usedAt || record.expiresAt < new Date()) return null;
  const claimed = await prisma.authToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: new Date() } });
  return claimed.count === 1 ? record.userId : null;
}

/** Checks a reset token without using it (to show the form only for valid links). */
export async function peekAuthToken(token: string, type: AuthTokenType): Promise<boolean> {
  if (!token || token.length > 200) return false;
  const record = await prisma.authToken.findUnique({ where: { tokenHash: sha256(token) } });
  return Boolean(record && record.type === type && !record.usedAt && record.expiresAt > new Date());
}

export async function resetPasswordWithToken(token: string, newPassword: string) {
  const record = await prisma.authToken.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!record || record.type !== "PASSWORD_RESET" || record.usedAt || record.expiresAt < new Date()) {
    throw new AccountError("This reset link is invalid or has expired. Request a new one.");
  }
  const policy = passwordPolicyError(newPassword, { email: record.user.email, name: record.user.name });
  if (policy) throw new AccountError(policy);
  const userId = await consumeAuthToken(token, "PASSWORD_RESET");
  if (!userId) throw new AccountError("This reset link is invalid or has expired. Request a new one.");
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      // Following a reset link proves control of the inbox, so the email counts as verified.
      data: { passwordHash: await hashPassword(newPassword), emailVerifiedAt: record.user.emailVerifiedAt ?? new Date() },
    }),
    prisma.session.deleteMany({ where: { userId } }),
  ]);
  return record.user;
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string, keepSessionId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.passwordHash || !(await verifyPassword(user.passwordHash, currentPassword))) {
    throw new AccountError("Your current password is incorrect.");
  }
  const policy = passwordPolicyError(newPassword, { email: user.email, name: user.name });
  if (policy) throw new AccountError(policy);
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(newPassword) } }),
    prisma.session.deleteMany({ where: { userId, id: { not: keepSessionId } } }),
  ]);
  return user;
}

/**
 * Delete a customer account. Personal data on the account is removed; order
 * records are kept (businesses must keep sales records) but detached from the
 * login. Staff accounts must be demoted first.
 */
export async function deleteCustomerAccount(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AccountError("Account not found.");
  if (user.role !== "CUSTOMER") throw new AccountError("Staff accounts can't be deleted here. Ask the store owner.");
  await prisma.$transaction([
    prisma.session.deleteMany({ where: { userId } }),
    prisma.authToken.deleteMany({ where: { userId } }),
    prisma.address.deleteMany({ where: { userId } }),
    prisma.wishlistItem.deleteMany({ where: { userId } }),
    prisma.cart.deleteMany({ where: { userId } }),
    prisma.review.updateMany({ where: { userId }, data: { authorName: "Former customer", userId: null } }),
    prisma.newsletterSubscriber.updateMany({ where: { email: user.email }, data: { status: "UNSUBSCRIBED", unsubscribedAt: new Date() } }),
    prisma.user.update({
      where: { id: userId },
      data: {
        email: `deleted-${user.id}@deleted.invalid`,
        name: "Deleted customer",
        phone: null,
        passwordHash: null,
        marketingOptIn: false,
        deletedAt: new Date(),
        disabledAt: new Date(),
      },
    }),
  ]);
}
