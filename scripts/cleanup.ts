/**
 * Routine housekeeping. Safe to run daily (a cron job, a scheduled task, or the
 * /api/cron/cleanup endpoint on Vercel — see docs/DEPLOYMENT.md):
 *
 *   npm run maintenance:cleanup
 *
 * What it removes is listed in src/lib/maintenance.ts. Orders, customers,
 * payments and the audit log are never touched.
 */

try {
  process.loadEnvFile?.();
} catch {
  /* no .env */
}

async function main() {
  // Imported after loading .env so the database client sees DATABASE_URL.
  const { runCleanup } = await import("../src/lib/maintenance");
  const { prisma } = await import("../src/lib/db");
  try {
    const r = await runCleanup();
    console.log(
      `Removed: ${r.sessions} sessions, ${r.tokens} tokens, ${r.rateLimits} rate-limit rows, ${r.guestCarts} guest carts, ${r.unconfirmedSignups} unconfirmed signups, ${r.unusedImages} unused images.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

export {};
