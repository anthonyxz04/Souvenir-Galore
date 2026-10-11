import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { formatMoney } from "@/lib/money";
import { allowedOrderTransitions, canTransitionPayment, orderStatusLabel, ORDER_STATUS_TONE, PAYMENT_STATUS_LABEL, PAYMENT_STATUS_TONE } from "@/lib/orders/status";
import { getAllSettings } from "@/lib/settings";
import { digitsOnly } from "@/lib/text";
import { AdminPageHeader, formatDateTime, KeyValue, Panel } from "@/components/admin/admin-ui";
import { NoteForm, RefundForm, RejectPaymentForm, StatusForm, VerifyPaymentForm } from "@/components/admin/order-actions";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/form-message";
import { PrintButton } from "@/components/admin/print-button";

export const metadata: Metadata = { title: "Order" };

const PAYMENT_RECORD_LABEL: Record<string, string> = {
  PENDING: "Waiting",
  SUBMITTED: "Submitted by customer",
  VERIFIED: "Verified",
  REJECTED: "Not confirmed",
  REFUNDED: "Refunded",
};

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireStaffPage("orders:view", `/admin/orders/${id}`);
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: { include: { product: { select: { id: true } } } },
      payments: { orderBy: { createdAt: "desc" } },
      events: { orderBy: { createdAt: "desc" } },
      user: { select: { id: true, name: true, email: true } },
    },
  });
  if (!order) notFound();
  const settings = await getAllSettings();
  const currency = { code: order.currency, decimals: settings.commerce.currencyDecimals, locale: settings.commerce.currencyLocale };
  const fmt = (minor: number) => formatMoney(minor, currency);
  const canManage = hasPermission(user.role, "orders:manage");
  const canVerify = hasPermission(user.role, "payments:verify");
  const transitions = allowedOrderTransitions(order.status, order.fulfillmentMethod).map((s) => ({ value: s, label: orderStatusLabel(s, order.fulfillmentMethod) }));
  const phoneDigits = digitsOnly(order.phone);
  const canMarkPaid = canTransitionPayment(order.paymentStatus, "PAID") && order.status !== "CANCELLED";

  return (
    <div className="space-y-6">
      <AdminPageHeader
        back={{ href: "/admin/orders", label: "Orders" }}
        title={`Order ${order.number}`}
        description={`Placed ${formatDateTime(order.createdAt)}`}
        actions={
          <>
            <Badge tone={ORDER_STATUS_TONE[order.status]}>{orderStatusLabel(order.status, order.fulfillmentMethod)}</Badge>
            <Badge tone={PAYMENT_STATUS_TONE[order.paymentStatus]}>{PAYMENT_STATUS_LABEL[order.paymentStatus]}</Badge>
            <PrintButton />
          </>
        }
      />

      {order.cancellationRequestedAt && order.status !== "CANCELLED" ? (
        <Notice tone="warning" title="The customer asked to cancel">
          {order.cancellationReason ? `“${order.cancellationReason}” — ` : ""}requested {formatDateTime(order.cancellationRequestedAt)}. Cancel the order below if you agree, then refund any payment received.
        </Notice>
      ) : null}
      {order.paymentStatus === "UNDER_REVIEW" ? (
        <Notice tone="warning" title="Payment to verify">
          The customer says they paid with {order.paymentMethodName}. Check your account for {fmt(order.total)} with reference {order.payments.find((p) => p.status === "SUBMITTED")?.reference ?? order.number} before confirming.
        </Notice>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-6">
          <Panel title="Items" padded={false}>
            <ul className="divide-y divide-line/70">
              {order.items.map((item) => (
                <li key={item.id} className="flex gap-4 px-5 py-4">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-medium">
                      {item.quantity} × {item.product ? <Link href={`/admin/products/${item.product.id}`} className="hover:underline">{item.productName}</Link> : item.productName}
                    </p>
                    <p className="text-sm text-ink-soft">
                      {[item.variantTitle, item.sku ? `SKU ${item.sku}` : null].filter(Boolean).join(", ") || "Standard"}
                    </p>
                    {Array.isArray(item.personalization) && item.personalization.length ? (
                      <div className="rounded-lg bg-wax-soft/60 px-3 py-2 text-sm">
                        <p className="font-medium">Personalization</p>
                        {(item.personalization as { label: string; value: string }[]).map((p) => (
                          <p key={p.label}>
                            {p.label}: <span className="whitespace-pre-line font-medium">{p.value}</span>
                          </p>
                        ))}
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-2 text-xs">
                      {item.madeToOrder ? <Badge tone="wax">Made to order{item.prepTimeMaxDays ? `, up to ${item.prepTimeMaxDays} days` : ""}</Badge> : null}
                      {item.isBackorder ? <Badge tone="warning">Backorder</Badge> : null}
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-medium tabular-nums">{fmt(item.lineTotal)}</p>
                    <p className="text-ink-soft tabular-nums">
                      {fmt(item.unitPrice)}
                      {item.personalizationPrice ? ` + ${fmt(item.personalizationPrice)}` : ""} each
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <dl className="space-y-1.5 border-t border-line px-5 py-4 text-[0.9375rem]">
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd className="tabular-nums">{fmt(order.subtotal)}</dd>
              </div>
              {order.discountTotal ? (
                <div className="flex justify-between">
                  <dt>Discount {order.discountCode ? `(${order.discountCode})` : ""}</dt>
                  <dd className="tabular-nums">−{fmt(order.discountTotal)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt>{order.fulfillmentMethod === "PICKUP" ? "Pickup" : `Delivery${order.deliveryZoneName ? ` (${order.deliveryZoneName})` : ""}`}</dt>
                <dd className="tabular-nums">{fmt(order.deliveryFee)}</dd>
              </div>
              {order.taxTotal ? (
                <div className="flex justify-between text-ink-soft">
                  <dt>Tax{order.taxIncluded ? " (included)" : ""}</dt>
                  <dd className="tabular-nums">{fmt(order.taxTotal)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{fmt(order.total)}</dd>
              </div>
              {order.refundedTotal ? (
                <div className="flex justify-between text-wine">
                  <dt>Refunded</dt>
                  <dd className="tabular-nums">−{fmt(order.refundedTotal)}</dd>
                </div>
              ) : null}
            </dl>
          </Panel>

          {order.customerNote ? (
            <Panel title="Customer note">
              <p className="whitespace-pre-line">{order.customerNote}</p>
            </Panel>
          ) : null}

          <Panel title="History" description="Customer-visible updates and internal notes">
            <ol className="space-y-4">
              {order.events.map((event) => (
                <li key={event.id} className="flex gap-3">
                  <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${event.isInternal ? "bg-line-strong" : "bg-olive"}`} aria-hidden />
                  <div className="min-w-0">
                    <p className="whitespace-pre-line text-[0.9375rem]">{event.message}</p>
                    <p className="text-xs text-ink-soft">
                      {formatDateTime(event.createdAt)}
                      {event.actorName ? `, ${event.actorName}` : ""}
                      {event.isInternal ? " — internal" : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            {canManage ? (
              <div className="mt-6 border-t border-line pt-5">
                <NoteForm orderId={order.id} />
              </div>
            ) : null}
          </Panel>
        </div>

        <div className="space-y-6">
          {canManage ? (
            <Panel title="Fulfillment">
              <StatusForm orderId={order.id} options={transitions} />
            </Panel>
          ) : null}

          <Panel title="Payment" description={`${order.paymentMethodName}`}>
            <div className="space-y-4">
              {order.payments.length ? (
                <ul className="space-y-2 text-sm">
                  {order.payments.map((payment) => (
                    <li key={payment.id} className="rounded-xl bg-white/70 p-3">
                      <div className="flex justify-between gap-2">
                        <span className="font-medium">
                          {payment.kind === "REFUND" ? "Refund" : "Payment"} {fmt(payment.amount)}
                        </span>
                        <span className="text-ink-soft">{PAYMENT_RECORD_LABEL[payment.status]}</span>
                      </div>
                      {payment.reference ? <p>Reference: {payment.reference}</p> : null}
                      {payment.customerNote ? <p className="text-ink-soft">Customer: {payment.customerNote}</p> : null}
                      {payment.reviewedByName ? (
                        <p className="text-ink-soft">
                          {payment.status === "VERIFIED" ? "Verified" : payment.status === "REFUNDED" ? "Recorded" : "Reviewed"} by {payment.reviewedByName}, {formatDateTime(payment.reviewedAt)}
                        </p>
                      ) : null}
                      {payment.adminNote ? <p className="text-ink-soft">Note: {payment.adminNote}</p> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
              {canVerify && canMarkPaid ? <VerifyPaymentForm orderId={order.id} isCash={order.paymentMethodType === "CASH_ON_DELIVERY"} /> : null}
              {canVerify && order.paymentStatus === "UNDER_REVIEW" ? (
                <details className="rounded-xl ring-1 ring-line">
                  <summary className="px-4 py-3 text-sm">Couldn&apos;t find the payment?</summary>
                  <div className="px-4 pb-4">
                    <RejectPaymentForm orderId={order.id} />
                  </div>
                </details>
              ) : null}
              {canVerify && (order.paymentStatus === "PAID" || order.paymentStatus === "PARTIALLY_REFUNDED") ? (
                <details className="rounded-xl ring-1 ring-line">
                  <summary className="px-4 py-3 text-sm">Record a refund</summary>
                  <div className="px-4 pb-4">
                    <RefundForm orderId={order.id} remaining={fmt(order.total - order.refundedTotal)} />
                  </div>
                </details>
              ) : null}
              {!canVerify && canMarkPaid ? <p className="text-sm text-ink-soft">An administrator verifies payments.</p> : null}
            </div>
          </Panel>

          <Panel title="Customer">
            <KeyValue
              items={[
                { label: "Name", value: order.customerName },
                { label: "Email", value: <a href={`mailto:${order.email}?subject=${encodeURIComponent(`Your order ${order.number}`)}`} className="underline underline-offset-2">{order.email}</a> },
                {
                  label: "Phone",
                  value: (
                    <span className="space-x-2">
                      <a href={`tel:${order.phone.replace(/[^\d+]/g, "")}`} className="underline underline-offset-2">
                        {order.phone}
                      </a>
                      {phoneDigits.length >= 10 ? (
                        <a href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noopener noreferrer" className="text-sm text-olive underline underline-offset-2">
                          WhatsApp
                        </a>
                      ) : null}
                    </span>
                  ),
                },
                { label: "Account", value: order.user ? <Link href={`/admin/customers/${order.user.id}`} className="underline underline-offset-2">View customer</Link> : "Guest checkout" },
              ]}
            />
          </Panel>

          <Panel title={order.fulfillmentMethod === "PICKUP" ? "Pickup" : "Delivery address"}>
            {order.fulfillmentMethod === "DELIVERY" ? (
              <address className="not-italic leading-relaxed">
                {order.shipRecipient}
                <br />
                {order.shipLine1}
                {order.shipLine2 ? <><br />{order.shipLine2}</> : null}
                <br />
                {[order.shipCity, order.shipRegion].filter(Boolean).join(", ")}
                <br />
                {order.shipPhone}
                {order.shipInstructions ? <span className="mt-2 block text-sm text-ink-soft">Instructions: {order.shipInstructions}</span> : null}
              </address>
            ) : (
              <p className="text-ink-soft">Customer collects the order{settings.pickup.locationName ? ` from ${settings.pickup.locationName}` : ""}.</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
