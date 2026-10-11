/**
 * OPTIONAL sample catalog for trying the store before real products exist.
 *
 *   npm run db:demo          (requires `npm run db:seed` first)
 *   npm run db:demo:remove   (deletes every sample product)
 *
 * The same can be done from the dashboard (Dashboard → "Add sample products").
 * Sample products use illustrated images, SKUs starting with "DEMO-", and a
 * note in their description. No reviews, testimonials or orders are created.
 */

try {
  process.loadEnvFile?.();
} catch {
  /* no .env */
}

async function main() {
  const { prisma } = await import("../src/lib/db");
  const { addDemoProduct, DEMO_PRODUCT_COUNT } = await import("../src/lib/demo-catalog");
  try {
    if ((await prisma.category.count()) === 0) throw new Error("Run `npm run db:seed` first.");
    for (let index = 0; index < DEMO_PRODUCT_COUNT; index += 1) {
      const result = await addDemoProduct(index, null);
      console.log(`${result.created ? "✓" : "·"} ${result.name}${result.created ? "" : " (already there)"}`);
    }
    console.log("\nSample catalog ready. Remove it before launch with `npm run db:demo:remove` or from the dashboard.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

export {};
