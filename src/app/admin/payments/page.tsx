import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/money";
import { registeredProviderKeys } from "@/lib/payments/providers";
import { missingRequirements, PAYMENT_TYPE_INFO } from "@/lib/payments/rules";
import { getCurrency } from "@/lib/settings";
import { movePaymentMethodAction, setPaymentMethodEnabledAction } from "@/server/actions/admin/payments";
import { AdminPageHeader, formatDateTime, Panel } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { ArrowDownIcon, ArrowUpIcon } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Payments" };

export default async function PaymentsPage() {
  await requireStaffPage("payment-methods:manage", "/admin/payments");
  const [methods, toVerify, currency] = await Promise.all([
    prisma.paymentMethod.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }], include: { _count: { select: { orders: true } } } }),
    prisma.order.findMany({ where: { paymentStatus: "UNDER_REVIEW", status: { not: "CANCELLED" } }, orderBy: { updatedAt: "asc" }, include: { payments: { where: { status: "SUBMITTED" }, take: 1 } } }),
    getCurrency(),
  ]);
  const providers = registeredProviderKeys();

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Payments"
        description="Choose which payment methods customers can use. Every method starts switched off, and a method can't be switched on until its required details are filled in."
      />

      {toVerify.length ? (
        <Panel title={`Payments to verify (${toVerify.length})`} description="Customers reported these payments. Check your account, then confirm on the order page." padded={false}>
          <ul className="divide-y divide-line/70">
            {toVerify.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <span>
                  <Link href={`/admin/orders/${order.id}`} className="font-medium hover:underline">
                    {order.number}
                  </Link>{" "}
                  <span className="text-ink-soft">
                    {order.customerName}, {order.paymentMethodName}, reference {order.payments[0]?.reference ?? "—"}
                  </span>
                </span>
                <span className="flex items-center gap-4">
                  <span className="tabular-nums">{formatMoney(order.total, currency)}</span>
                  <span className="text-sm text-ink-soft">{formatDateTime(order.updatedAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <div className="space-y-3">
        {methods.map((method, index) => {
          const missing = missingRequirements({ ...method, config: (method.config ?? {}) as Record<string, unknown> }, providers);
          return (
            <div key={method.id} className="flex flex-wrap items-center gap-4 rounded-2xl bg-plaster p-5 ring-1 ring-line/70">
              <div className="flex flex-col">
                <form action={movePaymentMethodAction}>
                  <input type="hidden" name="id" value={method.id} />
                  <input type="hidden" name="direction" value="up" />
                  <button type="submit" disabled={index === 0} className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-ink/5 disabled:opacity-30" aria-label={`Move ${method.name} up`}>
                    <ArrowUpIcon size={15} />
                  </button>
                </form>
                <form action={movePaymentMethodAction}>
                  <input type="hidden" name="id" value={method.id} />
                  <input type="hidden" name="direction" value="down" />
                  <button type="submit" disabled={index === methods.length - 1} className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-ink/5 disabled:opacity-30" aria-label={`Move ${method.name} down`}>
                    <ArrowDownIcon size={15} />
                  </button>
                </form>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/admin/payments/${method.id}`} className="text-lg font-medium hover:underline">
                    {method.name}
                  </Link>
                  <Badge tone={method.isEnabled ? "success" : "neutral"}>{method.isEnabled ? "On" : "Off"}</Badge>
                </div>
                <p className="text-sm text-ink-soft">{PAYMENT_TYPE_INFO[method.type].label}</p>
                {missing.length && !method.isEnabled ? <p className="mt-1 text-sm text-wax-ink">Needs: {missing.join(", ")}</p> : null}
              </div>
              <div className="flex items-center gap-2">
                <Link href={`/admin/payments/${method.id}`} className={buttonClass("ghost", "sm")}>
                  Configure
                </Link>
                <form action={setPaymentMethodEnabledAction}>
                  <input type="hidden" name="id" value={method.id} />
                  <input type="hidden" name="enable" value={method.isEnabled ? "false" : "true"} />
                  <button type="submit" className={buttonClass(method.isEnabled ? "secondary" : "primary", "sm")}>
                    {method.isEnabled ? "Turn off" : missing.length ? "Set up" : "Turn on"}
                  </button>
                </form>
              </div>
            </div>
          );
        })}
      </div>

      <Panel title="Add a payment method">
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/payments/new?type=MANUAL" className={buttonClass("secondary", "sm")}>
            Manual payment (bank, other)
          </Link>
          <Link href="/admin/payments/new?type=WHISH_MONEY" className={buttonClass("secondary", "sm")}>
            Whish Money
          </Link>
          <Link href="/admin/payments/new?type=CASH_ON_DELIVERY" className={buttonClass("secondary", "sm")}>
            Cash on delivery
          </Link>
          <Link href="/admin/payments/new?type=ONLINE_GATEWAY" className={buttonClass("secondary", "sm")}>
            Online gateway
          </Link>
        </div>
      </Panel>
    </div>
  );
}
