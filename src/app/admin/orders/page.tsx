import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guards";
import { ORDER_STATUSES, PAYMENT_STATUSES } from "@/lib/domain";
import { formatMoney } from "@/lib/money";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, orderStatusLabel, PAYMENT_STATUS_LABEL, PAYMENT_STATUS_TONE } from "@/lib/orders/status";
import { getCurrency } from "@/lib/settings";
import { AdminPageHeader, EmptyRow, FilterBar, FilterSearch, FilterSelect, formatDateTime, Table, Td, Th } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/misc";
import { buttonClass } from "@/components/ui/button";

export const metadata: Metadata = { title: "Orders" };
const PER_PAGE = 30;

type Search = { q?: string; status?: string; payment?: string; fulfillment?: string; page?: string };

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireStaffPage("orders:view", "/admin/orders");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const where: Prisma.OrderWhereInput = {};
  if (params.status && (ORDER_STATUSES as readonly string[]).includes(params.status)) where.status = params.status as Prisma.OrderWhereInput["status"];
  if (params.payment && (PAYMENT_STATUSES as readonly string[]).includes(params.payment)) where.paymentStatus = params.payment as Prisma.OrderWhereInput["paymentStatus"];
  if (params.fulfillment === "DELIVERY" || params.fulfillment === "PICKUP") where.fulfillmentMethod = params.fulfillment;
  const q = params.q?.trim().slice(0, 100);
  if (q) {
    where.OR = [
      { number: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { customerName: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
    ];
  }

  const [total, orders, currency] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: { _count: { select: { items: true } } },
    }),
    getCurrency(),
  ]);

  const query = new URLSearchParams(Object.entries(params).filter(([k, v]) => v && k !== "page") as [string, string][]);

  return (
    <div>
      <AdminPageHeader
        title="Orders"
        description="Payment status and fulfillment status are tracked separately. An order is paid only after a payment is verified."
        actions={
          <a href="/api/admin/orders/export" className={buttonClass("secondary", "sm")}>
            Export CSV
          </a>
        }
      />
      <FilterBar>
        <FilterSearch value={q} placeholder="Order number, name, email, phone" />
        <FilterSelect name="status" label="Order status" value={params.status} options={[{ value: "", label: "Any" }, ...ORDER_STATUSES.map((s) => ({ value: s, label: ORDER_STATUS_LABEL[s] }))]} />
        <FilterSelect name="payment" label="Payment" value={params.payment} options={[{ value: "", label: "Any" }, ...PAYMENT_STATUSES.map((s) => ({ value: s, label: PAYMENT_STATUS_LABEL[s] }))]} />
        <FilterSelect name="fulfillment" label="Method" value={params.fulfillment} options={[{ value: "", label: "Any" }, { value: "DELIVERY", label: "Delivery" }, { value: "PICKUP", label: "Pickup" }]} />
      </FilterBar>
      <Table>
        <thead>
          <tr>
            <Th>Order</Th>
            <Th>Placed</Th>
            <Th>Customer</Th>
            <Th>Status</Th>
            <Th>Payment</Th>
            <Th className="text-right">Total</Th>
          </tr>
        </thead>
        <tbody>
          {orders.length ? (
            orders.map((order) => (
              <tr key={order.id} className="hover:bg-white/50">
                <Td>
                  <Link href={`/admin/orders/${order.id}`} className="font-medium hover:underline">
                    {order.number}
                  </Link>
                  <p className="text-xs text-ink-soft">
                    {order._count.items === 1 ? "1 item" : `${order._count.items} items`}, {order.fulfillmentMethod === "PICKUP" ? "pickup" : "delivery"}
                  </p>
                </Td>
                <Td className="whitespace-nowrap text-sm text-ink-soft">{formatDateTime(order.createdAt)}</Td>
                <Td>
                  <p>{order.customerName}</p>
                  <p className="text-xs text-ink-soft">{order.email}</p>
                </Td>
                <Td>
                  <Badge tone={ORDER_STATUS_TONE[order.status]}>{orderStatusLabel(order.status, order.fulfillmentMethod)}</Badge>
                  {order.cancellationRequestedAt && order.status !== "CANCELLED" ? <p className="mt-1 text-xs text-wine">Cancellation requested</p> : null}
                </Td>
                <Td>
                  <Badge tone={PAYMENT_STATUS_TONE[order.paymentStatus]}>{PAYMENT_STATUS_LABEL[order.paymentStatus]}</Badge>
                  <p className="mt-1 text-xs text-ink-soft">{order.paymentMethodName}</p>
                </Td>
                <Td className="text-right tabular-nums">{formatMoney(order.total, currency)}</Td>
              </tr>
            ))
          ) : (
            <EmptyRow colSpan={6}>No orders match these filters.</EmptyRow>
          )}
        </tbody>
      </Table>
      <div className="mt-6">
        <Pagination page={page} pageCount={Math.max(1, Math.ceil(total / PER_PAGE))} hrefFor={(p) => `/admin/orders?${new URLSearchParams([...query.entries(), ...(p > 1 ? [["page", String(p)]] : [])]).toString()}`} />
      </div>
    </div>
  );
}
