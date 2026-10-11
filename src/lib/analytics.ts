/**
 * Dashboard metrics. Definitions (shown in the dashboard too):
 *  - Gross order value: total of all orders placed in the period, except cancelled ones.
 *  - Completed sales (revenue): money verified as received in the period
 *    (orders marked Paid / Partially refunded by payment date), minus refunds on those orders.
 *  - Outstanding: orders not cancelled whose payment is still unpaid, awaited or under review.
 *  - Refunds: refund records created in the period.
 */

import { prisma } from "./db";
import { variantAvailability } from "./catalog/pricing";

export const PERIODS = {
  "7d": { label: "Last 7 days", days: 7 },
  "30d": { label: "Last 30 days", days: 30 },
  "90d": { label: "Last 90 days", days: 90 },
  "365d": { label: "Last 12 months", days: 365 },
} as const;
export type PeriodKey = keyof typeof PERIODS;

const DAY = 86_400_000;

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export async function getDashboardMetrics(period: PeriodKey, lowStockDefault: number) {
  const days = PERIODS[period].days;
  const now = new Date();
  const start = new Date(startOfUtcDay(now).getTime() - (days - 1) * DAY);
  const previousStart = new Date(start.getTime() - days * DAY);

  const notCancelled = { status: { not: "CANCELLED" as const } };
  const revenueStatuses = { in: ["PAID" as const, "PARTIALLY_REFUNDED" as const] };

  const [
    placed,
    placedPrevious,
    paidOrders,
    paidPrevious,
    outstanding,
    refunds,
    cancelled,
    pendingOrders,
    awaitingVerification,
    newCustomers,
    bestsellerGroups,
    categoryRows,
    trackedVariants,
    openRequests,
  ] = await Promise.all([
    prisma.order.aggregate({ where: { createdAt: { gte: start }, ...notCancelled }, _sum: { total: true }, _count: { _all: true } }),
    prisma.order.aggregate({ where: { createdAt: { gte: previousStart, lt: start }, ...notCancelled }, _sum: { total: true }, _count: { _all: true } }),
    prisma.order.findMany({ where: { paidAt: { gte: start }, paymentStatus: revenueStatuses }, select: { total: true, refundedTotal: true, paidAt: true } }),
    prisma.order.aggregate({ where: { paidAt: { gte: previousStart, lt: start }, paymentStatus: revenueStatuses }, _sum: { total: true, refundedTotal: true }, _count: { _all: true } }),
    prisma.order.aggregate({ where: { ...notCancelled, paymentStatus: { in: ["UNPAID", "AWAITING_PAYMENT", "UNDER_REVIEW"] } }, _sum: { total: true }, _count: { _all: true } }),
    prisma.payment.aggregate({ where: { kind: "REFUND", createdAt: { gte: start } }, _sum: { amount: true }, _count: { _all: true } }),
    prisma.order.count({ where: { createdAt: { gte: start }, status: "CANCELLED" } }),
    prisma.order.count({ where: { status: "PENDING" } }),
    prisma.order.count({ where: { paymentStatus: "UNDER_REVIEW", ...notCancelled } }),
    prisma.user.count({ where: { role: "CUSTOMER", createdAt: { gte: start }, deletedAt: null } }),
    prisma.orderItem.groupBy({
      by: ["productId", "productName"],
      where: { order: { createdAt: { gte: start }, ...notCancelled } },
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 8,
    }),
    prisma.$queryRaw<{ name: string; total: bigint; quantity: bigint }[]>`
      SELECT c."name" AS name, COALESCE(SUM(oi."lineTotal"), 0)::bigint AS total, COALESCE(SUM(oi."quantity"), 0)::bigint AS quantity
      FROM "OrderItem" oi
      JOIN "Order" o ON o."id" = oi."orderId"
      JOIN "ProductCategory" pc ON pc."productId" = oi."productId"
      JOIN "Category" c ON c."id" = pc."categoryId"
      WHERE o."paidAt" >= ${start.toISOString()}::timestamp
        AND o."paymentStatus" IN ('PAID', 'PARTIALLY_REFUNDED')
      GROUP BY c."name"
      ORDER BY total DESC
      LIMIT 8`,
    prisma.productVariant.findMany({
      where: { isActive: true, product: { status: "ACTIVE", trackInventory: true }, stock: { lte: 50 } },
      select: {
        id: true,
        title: true,
        stock: true,
        sku: true,
        product: { select: { id: true, name: true, trackInventory: true, allowBackorder: true, madeToOrder: true, lowStockThreshold: true } },
      },
      orderBy: { stock: "asc" },
      take: 200,
    }),
    prisma.customRequest.count({ where: { status: { in: ["NEW", "IN_REVIEW"] } } }),
  ]);

  const revenue = paidOrders.reduce((sum, o) => sum + o.total - o.refundedTotal, 0);
  const revenuePrevious = (paidPrevious._sum.total ?? 0) - (paidPrevious._sum.refundedTotal ?? 0);

  // Daily (or monthly for 12 months) verified revenue
  const monthly = days > 92;
  const buckets = new Map<string, number>();
  const labels: { key: string; label: string }[] = [];
  if (monthly) {
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const key = d.toISOString().slice(0, 7);
      buckets.set(key, 0);
      labels.push({ key, label: d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }) });
    }
  } else {
    for (let i = 0; i < days; i += 1) {
      const d = new Date(start.getTime() + i * DAY);
      const key = d.toISOString().slice(0, 10);
      buckets.set(key, 0);
      labels.push({ key, label: d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) });
    }
  }
  for (const order of paidOrders) {
    if (!order.paidAt) continue;
    const key = monthly ? order.paidAt.toISOString().slice(0, 7) : order.paidAt.toISOString().slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + order.total - order.refundedTotal);
  }

  const lowStock = trackedVariants
    .filter((variant) => {
      const availability = variantAvailability(variant, variant.product, lowStockDefault);
      return availability.status === "low_stock" || availability.status === "out_of_stock" || (variant.stock <= 0 && !variant.product.allowBackorder);
    })
    .slice(0, 12);

  return {
    period: { start, days, monthly },
    grossOrderValue: placed._sum.total ?? 0,
    grossOrderValuePrevious: placedPrevious._sum.total ?? 0,
    orderCount: placed._count._all,
    orderCountPrevious: placedPrevious._count._all,
    revenue,
    revenuePrevious,
    paidOrderCount: paidOrders.length,
    averageOrderValue: paidOrders.length ? Math.round(revenue / paidOrders.length) : 0,
    outstandingValue: outstanding._sum.total ?? 0,
    outstandingCount: outstanding._count._all,
    refundsValue: refunds._sum.amount ?? 0,
    refundsCount: refunds._count._all,
    cancelledCount: cancelled,
    pendingOrders,
    awaitingVerification,
    newCustomers,
    openRequests,
    salesSeries: labels.map(({ key, label }) => ({ key, label, value: buckets.get(key) ?? 0 })),
    bestsellers: bestsellerGroups.map((g) => ({ productId: g.productId, name: g.productName, quantity: g._sum.quantity ?? 0, total: g._sum.lineTotal ?? 0 })),
    salesByCategory: categoryRows.map((row) => ({ name: row.name, total: Number(row.total), quantity: Number(row.quantity) })),
    lowStock,
  };
}

export type DashboardMetrics = Awaited<ReturnType<typeof getDashboardMetrics>>;
