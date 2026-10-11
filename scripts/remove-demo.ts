/**
 * Deletes every sample product (SKU starting with "DEMO-") and its images.
 * Sample products that appear in orders are archived instead.
 *
 *   npm run db:demo:remove
 */

try {
  process.loadEnvFile?.();
} catch {
  /* no .env */
}

async function main() {
  const { prisma } = await import("../src/lib/db");
  const { removeDemoCatalog } = await import("../src/lib/demo-catalog");
  try {
    const { deleted, archived } = await removeDemoCatalog();
    console.log(`Removed ${deleted} sample products${archived ? ` and archived ${archived} that appear in orders` : ""}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

export {};
