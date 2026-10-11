import { prisma } from "./db";

/**
 * Fixed-window rate limiter backed by PostgreSQL, so limits hold across every
 * server instance (important on serverless hosting). A single atomic upsert
 * increments the counter or starts a new window.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ ok: boolean; remaining: number; resetAt: Date }> {
  // Prisma stores DateTime columns in UTC, so compare against the UTC clock.
  const rows = await prisma.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt")
    VALUES (${key}, 1, (NOW() AT TIME ZONE 'UTC') + make_interval(secs => ${windowSeconds}))
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."resetAt" <= (NOW() AT TIME ZONE 'UTC') THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" <= (NOW() AT TIME ZONE 'UTC') THEN EXCLUDED."resetAt" ELSE "RateLimit"."resetAt" END
    RETURNING "count", "resetAt"
  `;
  const row = rows[0];
  const count = Number(row?.count ?? 1);
  return {
    ok: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt: row?.resetAt ?? new Date(Date.now() + windowSeconds * 1000),
  };
}

/** Preset limits for sensitive endpoints. */
export const LIMITS = {
  loginPerIp: { limit: 20, window: 15 * 60 },
  /** Wrong passwords for one account (successful sign-ins don't count). */
  loginPerAccount: { limit: 6, window: 15 * 60 },
  register: { limit: 5, window: 60 * 60 },
  passwordResetPerIp: { limit: 10, window: 60 * 60 },
  passwordResetPerAccount: { limit: 3, window: 60 * 60 },
  verificationEmail: { limit: 3, window: 60 * 60 },
  publicForm: { limit: 6, window: 10 * 60 },
  newsletter: { limit: 5, window: 60 * 60 },
  review: { limit: 5, window: 24 * 60 * 60 },
  paymentReference: { limit: 8, window: 60 * 60 },
  discountCode: { limit: 20, window: 10 * 60 },
  upload: { limit: 120, window: 10 * 60 },
  search: { limit: 120, window: 60 },
} as const;

export async function checkLimit(
  scope: keyof typeof LIMITS,
  identifier: string | null,
): Promise<boolean> {
  if (!identifier) return true;
  const preset = LIMITS[scope];
  const result = await rateLimit(`${scope}:${identifier}`, preset.limit, preset.window);
  return result.ok;
}

/**
 * True when the counter for this key has already reached its limit in the
 * current window. Reads without counting, for limits that should only count
 * failures (e.g. wrong passwords for one account).
 */
export async function isLimited(scope: keyof typeof LIMITS, identifier: string | null): Promise<boolean> {
  if (!identifier) return false;
  const row = await prisma.rateLimit.findUnique({ where: { key: `${scope}:${identifier}` }, select: { count: true, resetAt: true } });
  return !!row && row.resetAt.getTime() > Date.now() && row.count >= LIMITS[scope].limit;
}

/** Forget the counter for this key (e.g. after a successful sign-in). */
export async function clearLimit(scope: keyof typeof LIMITS, identifier: string | null): Promise<void> {
  if (!identifier) return;
  await prisma.rateLimit.deleteMany({ where: { key: `${scope}:${identifier}` } });
}

export const RATE_LIMIT_MESSAGE = "Too many attempts. Please wait a few minutes and try again.";
