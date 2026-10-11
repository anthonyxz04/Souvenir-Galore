import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guards";
import { hasPermission, ROLE_LABEL } from "@/lib/auth/permissions";
import { formatMoney } from "@/lib/money";
import { orderStatusLabel, ORDER_STATUS_TONE, PAYMENT_STATUS_LABEL, PAYMENT_STATUS_TONE, REVENUE_PAYMENT_STATUSES } from "@/lib/orders/status";
import { getCurrency } from "@/lib/settings";
import { setUserDisabledAction } from "@/server/actions/admin/staff";
import { AdminPageHeader, formatDate, formatDateTime, KeyValue, Panel, Table, Td, Th, EmptyRow } from "@/components/admin/admin-ui";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Customer" };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireStaffPage("customers:view", `/admin/customers/${id}`);
  const customer = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      createdAt: true,
      lastLoginAt: true,
      emailVerifiedAt: true,
      marketingOptIn: true,
      disabledAt: true,
      deletedAt: true,
      addresses: { orderBy: { isDefault: "desc" } },
      orders: { orderBy: { createdAt: "desc" }, take: 50 },
      customRequests: { orderBy: { createdAt: "desc" }, take: 10, select: { id: true, number: true, productType: true, status: true, createdAt: true } },
    },
  });
  if (!customer) notFound();
  const currency = await getCurrency();
  const fmt = (m: number) => formatMoney(m, currency);
  const paidTotal = customer.orders.filter((o) => REVENUE_PAYMENT_STATUSES.includes(o.paymentStatus)).reduce((s, o) => s + o.total - o.refundedTotal, 0);
  const canDisable = hasPermission(viewer.role, "staff:manage") && customer.role === "CUSTOMER" && !customer.deletedAt;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        back={{ href: "/admin/customers", label: "Customers" }}
        title={customer.name}
        description={`${ROLE_LABEL[customer.role]} since ${formatDate(customer.createdAt)}`}
        actions={
          canDisable ? (
            <ConfirmButton
              action={setUserDisabledAction}
              fields={{ userId: customer.id, disabled: customer.disabledAt ? "false" : "true" }}
              label={customer.disabledAt ? "Re-enable account" : "Disable account"}
              title={customer.disabledAt ? "Re-enable this account?" : "Disable this account?"}
              description={customer.disabledAt ? "The customer will be able to sign in again." : "The customer is signed out everywhere and can't sign in. Their orders are kept."}
              confirmLabel={customer.disabledAt ? "Re-enable" : "Disable"}
              confirmVariant={customer.disabledAt ? "primary" : "danger"}
            />
          ) : null
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Contact">
          <KeyValue
            items={[
              { label: "Email", value: <a href={`mailto:${customer.email}`} className="underline underline-offset-2">{customer.email}</a> },
              { label: "Phone", value: customer.phone ?? "—" },
              { label: "Email confirmed", value: customer.emailVerifiedAt ? formatDate(customer.emailVerifiedAt) : "No" },
              { label: "Marketing emails", value: customer.marketingOptIn ? "Opted in" : "No" },
              { label: "Last sign-in", value: formatDateTime(customer.lastLoginAt) },
              ...(customer.disabledAt ? [{ label: "Status", value: <Badge tone="danger">Disabled</Badge> }] : []),
            ]}
          />
        </Panel>
        <Panel title="Summary">
          <KeyValue
            items={[
              { label: "Orders", value: String(customer.orders.length) },
              { label: "Paid to date", value: fmt(paidTotal) },
              { label: "Custom requests", value: String(customer.customRequests.length) },
            ]}
          />
        </Panel>
        <Panel title="Addresses">
          {customer.addresses.length ? (
            <ul className="space-y-3 text-sm">
              {customer.addresses.map((a) => (
                <li key={a.id}>
                  <p className="font-medium">
                    {a.label || a.recipientName} {a.isDefault ? <Badge tone="success">Default</Badge> : null}
                  </p>
                  <p className="text-ink-soft">{[a.line1, a.line2, a.city, a.region].filter(Boolean).join(", ")}</p>
                  <p className="text-ink-soft">{a.phone}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-soft">No saved addresses.</p>
          )}
        </Panel>
      </div>
      <Table>
        <thead>
          <tr>
            <Th>Order</Th>
            <Th>Placed</Th>
            <Th>Status</Th>
            <Th>Payment</Th>
            <Th className="text-right">Total</Th>
          </tr>
        </thead>
        <tbody>
          {customer.orders.length ? (
            customer.orders.map((o) => (
              <tr key={o.id}>
                <Td>
                  <Link href={`/admin/orders/${o.id}`} className="font-medium hover:underline">
                    {o.number}
                  </Link>
                </Td>
                <Td className="text-sm text-ink-soft">{formatDateTime(o.createdAt)}</Td>
                <Td>
                  <Badge tone={ORDER_STATUS_TONE[o.status]}>{orderStatusLabel(o.status, o.fulfillmentMethod)}</Badge>
                </Td>
                <Td>
                  <Badge tone={PAYMENT_STATUS_TONE[o.paymentStatus]}>{PAYMENT_STATUS_LABEL[o.paymentStatus]}</Badge>
                </Td>
                <Td className="text-right tabular-nums">{fmt(o.total)}</Td>
              </tr>
            ))
          ) : (
            <EmptyRow colSpan={5}>No orders yet.</EmptyRow>
          )}
        </tbody>
      </Table>
      {customer.customRequests.length ? (
        <Panel title="Custom requests">
          <ul className="space-y-1 text-sm">
            {customer.customRequests.map((r) => (
              <li key={r.id}>
                <Link href={`/admin/custom-requests/${r.id}`} className="underline underline-offset-2">
                  {r.number}
                </Link>{" "}
                {r.productType} ({formatDate(r.createdAt)})
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
