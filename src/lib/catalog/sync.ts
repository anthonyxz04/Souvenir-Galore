import { prisma, type Tx } from "../db";
import { denormalizedPrices, variantAvailability } from "./pricing";

type Client = Tx | typeof prisma;

/** Recompute the listing fields stored on Product (prices, stock flag). */
export async function syncProductDerived(productId: string, client: Client = prisma, defaultLowStock = 3): Promise<void> {
  const product = await client.product.findUnique({
    where: { id: productId },
    select: {
      trackInventory: true,
      allowBackorder: true,
      madeToOrder: true,
      lowStockThreshold: true,
      variants: { select: { price: true, salePrice: true, stock: true, isActive: true } },
    },
  });
  if (!product) return;
  const prices = denormalizedPrices(product.variants);
  const inStock = product.variants.some((variant) => variantAvailability(variant, product, defaultLowStock).purchasable);
  await client.product.update({ where: { id: productId }, data: { ...prices, inStock } });
}

/** Recompute the average rating from approved reviews. */
export async function syncProductRating(productId: string, client: Client = prisma): Promise<void> {
  const aggregate = await client.review.aggregate({
    where: { productId, status: "APPROVED" },
    _avg: { rating: true },
    _count: { _all: true },
  });
  await client.product.update({
    where: { id: productId },
    data: {
      ratingAvg: aggregate._avg.rating ? Math.round(aggregate._avg.rating * 100) / 100 : 0,
      ratingCount: aggregate._count._all,
    },
  });
}
