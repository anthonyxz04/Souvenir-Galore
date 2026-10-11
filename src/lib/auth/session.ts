import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "../db";
import { env } from "../env";
import type { Role } from "../domain";
import { isStaffRole } from "./permissions";
import { generateToken, sha256 } from "./crypto";

/**
 * Session handling (modelled on the approach recommended by the Lucia project):
 *  - A random 256-bit token lives only in an httpOnly, Secure, SameSite=Lax cookie.
 *  - The database stores SHA-256(token) as the session id.
 *  - Customer sessions last 30 days and slide forward with use; staff sessions
 *    last 7 days. Passwords changes and resets end every other session.
 */

export const SESSION_COOKIE = env.secureCookies ? "__Host-sg_session" : "sg_session";
const DAY = 86_400_000;
const CUSTOMER_TTL = 30 * DAY;
const STAFF_TTL = 7 * DAY;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: Role;
  emailVerifiedAt: Date | null;
};

function ttlFor(role: Role): number {
  return isStaffRole(role) ? STAFF_TTL : CUSTOMER_TTL;
}

export function sessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: env.secureCookies,
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}

/** Creates a session and sets the cookie. Call only from Server Actions or Route Handlers. */
export async function createSession(userId: string, role: Role, userAgent: string | null): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + ttlFor(role));
  await prisma.session.create({
    data: { id: sha256(token), userId, expiresAt, userAgent: userAgent?.slice(0, 300) ?? null },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
}

async function readToken(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  return token && token.length >= 32 && token.length <= 128 ? token : null;
}

async function validateToken(token: string): Promise<{ sessionId: string; user: SessionUser } | null> {
  const sessionId = sha256(token);
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      user: {
        select: { id: true, email: true, name: true, phone: true, role: true, emailVerifiedAt: true, disabledAt: true, deletedAt: true },
      },
    },
  });
  if (!session) return null;

  const now = Date.now();
  if (session.expiresAt.getTime() <= now || session.user.disabledAt || session.user.deletedAt) {
    await prisma.session.deleteMany({ where: { id: sessionId } });
    return null;
  }

  // Slide the expiry forward when less than half the lifetime remains.
  const ttl = ttlFor(session.user.role);
  if (session.expiresAt.getTime() - now < ttl / 2) {
    await prisma.session.update({
      where: { id: sessionId },
      data: { expiresAt: new Date(now + ttl), lastUsedAt: new Date(now) },
    });
  }

  const { disabledAt: _d, deletedAt: _x, ...user } = session.user;
  return { sessionId, user };
}

/** The signed-in user for this request, or null. Cached per request. */
export const getCurrentSession = cache(async (): Promise<{ sessionId: string; user: SessionUser } | null> => {
  const token = await readToken();
  if (!token) return null;
  return validateToken(token);
});

export async function getCurrentUser(): Promise<SessionUser | null> {
  return (await getCurrentSession())?.user ?? null;
}

/** Ends the current session and clears the cookie. */
export async function destroyCurrentSession(): Promise<void> {
  const token = await readToken();
  if (token) await prisma.session.deleteMany({ where: { id: sha256(token) } });
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** Ends every session for a user, optionally keeping the current one. */
export async function destroyUserSessions(userId: string, keepSessionId?: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { userId, ...(keepSessionId ? { id: { not: keepSessionId } } : {}) },
  });
}
