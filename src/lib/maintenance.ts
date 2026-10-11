/**
 * Routine housekeeping, safe to run daily. Used by `npm run maintenance:cleanup`
 * and by the scheduled endpoint /api/cron/cleanup (protected by CRON_SECRET).
 *
 *  - deletes expired sessions and used/expired sign-in tokens
 *  - deletes expired rate-limit counters
 *  - deletes guest carts: empty ones after 60 days, abandoned ones after 90 days
 *  - removes newsletter signups never confirmed after 30 days
 *  - deletes uploaded images not used anywhere for 7+ days (files and records)
 *
 * Orders, customers, payments and the audit log are never touched.
 */

import { prisma } from "./db";
import { deleteAssetFiles } from "./storage/images";

const DAY = 86_400_000;

export type CleanupResult = {
  sessions: number;
  tokens: number;
  rateLimits: number;
  guestCarts: number;
  unconfirmedSignups: number;
  unusedImages: number;
};

export async function runCleanup(now = Date.now()): Promise<CleanupResult> {
  const sessions = await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date(now) } } });
  const tokens = await prisma.authToken.deleteMany({ where: { OR: [{ expiresAt: { lt: new Date(now) } }, { usedAt: { not: null } }] } });
  const limits = await prisma.rateLimit.deleteMany({ where: { resetAt: { lt: new Date(now - DAY) } } });
  const emptyCarts = await prisma.cart.deleteMany({ where: { userId: null, updatedAt: { lt: new Date(now - 60 * DAY) }, items: { none: {} } } });
  const oldCarts = await prisma.cart.deleteMany({ where: { userId: null, updatedAt: { lt: new Date(now - 90 * DAY) } } });
  const pending = await prisma.newsletterSubscriber.deleteMany({ where: { status: "PENDING", createdAt: { lt: new Date(now - 30 * DAY) } } });

  const orphans = await prisma.mediaAsset.findMany({
    where: {
      createdAt: { lt: new Date(now - 7 * DAY) },
      productImages: { none: {} },
      categories: { none: {} },
      collections: { none: {} },
      homeSections: { none: {} },
      homeSectionItems: { none: {} },
      customRequestAttachments: { none: {} },
    },
    take: 500,
  });
  // Settings (logo, social sharing image) refer to images by id.
  const settings = await prisma.setting.findMany();
  const referenced = new Set(settings.flatMap((s) => Object.values((s.value ?? {}) as Record<string, unknown>).filter((v): v is string => typeof v === "string")));
  let unusedImages = 0;
  for (const asset of orphans) {
    if (referenced.has(asset.id)) continue;
    try {
      await deleteAssetFiles(asset);
    } catch (error) {
      console.warn(`[cleanup] could not delete files for ${asset.key}:`, error instanceof Error ? error.message : error);
      continue; // keep the record so the files can be retried next time
    }
    await prisma.mediaAsset.delete({ where: { id: asset.id } });
    unusedImages += 1;
  }

  return {
    sessions: sessions.count,
    tokens: tokens.count,
    rateLimits: limits.count,
    guestCarts: emptyCarts.count + oldCarts.count,
    unconfirmedSignups: pending.count,
    unusedImages,
  };
}
