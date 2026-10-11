import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/money";
import { orderStatusLabel, ORDER_STATUS_TONE, PAYMENT_STATUS_LABEL, PAYMENT_STATUS_TONE } from "@/lib/orders/status";
import { getCurrency } from "@/lib/settings";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Orders" };

export default async function AccountOrdersPage() {
  const user = await requireUser("/account/orders");
  const [orders, currency] = await Promise.all([
    prisma.order.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, include: { _count: { select: { items: true } } } }),
    getCurrency(),
  ]);
  return (
    <div className="space-y-8">
      <h1 className="font-display text-[2.25rem] leading-tight sm:text-title">Orders</h1>
      {orders.length ? (
        <ul className="space-y-3">
          {orders.map((order) => (
            <li key={order.id}>
              <Link href={`/account/orders/${order.number}`} className="grid gap-3 rounded-2xl bg-plaster p-5 hover:bg-white/70 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <p className="font-medium">{order.number}</p>
                  <p className="text-sm text-ink-soft">
                    {order.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}, {order._count.items === 1 ? "1 item" : `${order._count.items} items`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={ORDER_STATUS_TONE[order.status]}>{orderStatusLabel(order.status, order.fulfillmentMethod)}</Badge>
                  <Badge tone={PAYMENT_STATUS_TONE[order.paymentStatus]}>{PAYMENT_STATUS_LABEL[order.paymentStatus]}</Badge>
                  <span className="ml-1 text-[0.9375rem] font-medium">{formatMoney(order.total, currency)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No orders yet" action={<ButtonLink href="/shop">Browse the shop</ButtonLink>}>
          When you place an order it will appear here with its status.
        </EmptyState>
      )}
    </div>
  );
}
