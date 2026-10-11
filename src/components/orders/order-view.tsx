import type { AccessibleOrder } from "@/lib/orders/access";
import { customerCanRequestCancellation, customerCanSubmitPayment, orderStatusLabel, PAYMENT_STATUS_LABEL, PAYMENT_STATUS_TONE, trackerSteps } from "@/lib/orders/status";
import { formatMoney, type CurrencyConfig } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/form-message";
import { CheckIcon } from "@/components/ui/icons";
import { CancellationForm, PaymentReferenceForm } from "./order-forms";

function formatDate(date: Date) {
  return date.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function OrderTracker({ status, fulfillment }: { status: AccessibleOrder["order"]["status"]; fulfillment: AccessibleOrder["order"]["fulfillmentMethod"] }) {
  if (status === "CANCELLED") return <Notice tone="danger">This order was cancelled.</Notice>;
  const steps = trackerSteps(fulfillment);
  const currentIndex = Math.max(0, steps.indexOf(status));
  return (
    <ol className="grid grid-cols-5 gap-1.5" aria-label="Order progress">
      {steps.map((step, index) => {
        const done = index <= currentIndex;
        return (
          <li key={step} className="space-y-2" aria-current={index === currentIndex ? "step" : undefined}>
            <span className={cn("block h-1.5 rounded-full", done ? "bg-olive" : "bg-line")} />
            <span className={cn("block text-[0.75rem] leading-tight sm:text-sm", done ? "text-ink" : "text-ink-soft")}>{orderStatusLabel(step, fulfillment)}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function OrderView({ access, currency, token }: { access: AccessibleOrder; currency: CurrencyConfig; token: string | null }) {
  const { order } = access;
  const fmt = (minor: number) => formatMoney(minor, currency);
  const canSubmitPayment = customerCanSubmitPayment(order) && Boolean(order.paymentMethod?.allowCustomerReference);
  const showPaymentDetails = order.paymentMethodType !== "CASH_ON_DELIVERY" && ["AWAITING_PAYMENT", "UNDER_REVIEW"].includes(order.paymentStatus) && order.status !== "CANCELLED";
  const canCancel = (access.viewer.isOwner || access.viewer.hasToken) && customerCanRequestCancellation(order);

  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
      <div className="space-y-10 lg:col-span-7">
        <section aria-labelledby="progress-heading" className="space-y-4">
          <h2 id="progress-heading" className="font-display text-2xl">
            {orderStatusLabel(order.status, order.fulfillmentMethod)}
          </h2>
          <OrderTracker status={order.status} fulfillment={order.fulfillmentMethod} />
          {order.cancellationRequestedAt && order.status !== "CANCELLED" ? <Notice tone="warning">You asked to cancel this order. We&apos;ll confirm by email.</Notice> : null}
        </section>

        <section aria-labelledby="payment-heading" className="space-y-4 rounded-2xl bg-plaster p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="payment-heading" className="font-display text-2xl">
              Payment
            </h2>
            <Badge tone={PAYMENT_STATUS_TONE[order.paymentStatus]}>{PAYMENT_STATUS_LABEL[order.paymentStatus]}</Badge>
          </div>
          <p className="text-[0.9375rem]">
            {order.paymentMethodName} — {fmt(order.total)}
          </p>
          {order.paymentMethodType === "CASH_ON_DELIVERY" && order.paymentStatus === "UNPAID" ? (
            <p className="text-[0.9375rem] text-ink-soft">Please have {fmt(order.total)} ready {order.fulfillmentMethod === "PICKUP" ? "when you collect your order" : "for the courier"}.</p>
          ) : null}
          {showPaymentDetails && order.paymentInstructions ? (
            <div className="space-y-2 rounded-xl bg-white p-4 text-[0.9375rem]">
              <p className="font-medium">How to pay</p>
              <p className="whitespace-pre-line leading-relaxed">{order.paymentInstructions}</p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-t border-line pt-2">
                <dt className="text-ink-soft">Amount</dt>
                <dd className="font-medium">{fmt(order.total)}</dd>
                <dt className="text-ink-soft">Reference</dt>
                <dd className="font-medium">{order.number}</dd>
              </dl>
            </div>
          ) : null}
          {order.paymentStatus === "UNDER_REVIEW" ? (
            <Notice tone="info">We&apos;re checking your payment. Your order will be marked as paid once we confirm the money has arrived.</Notice>
          ) : null}
          {order.paymentStatus === "PAID" ? (
            <p className="flex items-center gap-2 text-[0.9375rem] text-olive">
              <CheckIcon size={18} /> Payment received{order.paidAt ? ` on ${order.paidAt.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}` : ""}.
            </p>
          ) : null}
          {canSubmitPayment && (access.viewer.isOwner || access.viewer.hasToken) ? (
            <PaymentReferenceForm orderId={order.id} token={token} methodName={order.paymentMethodName} />
          ) : null}
        </section>

        {order.events.length ? (
          <section aria-labelledby="history-heading" className="space-y-4">
            <h2 id="history-heading" className="font-display text-2xl">
              Updates
            </h2>
            <ol className="space-y-4 border-l border-line pl-5">
              {[...order.events].reverse().map((event) => (
                <li key={event.id} className="relative">
                  <span className="absolute -left-[1.6rem] top-1.5 h-2.5 w-2.5 rounded-full bg-olive ring-4 ring-limestone" aria-hidden />
                  <p className="text-[0.9375rem]">{event.message}</p>
                  <p className="text-sm text-ink-soft">{formatDate(event.createdAt)}</p>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {canCancel ? <CancellationForm orderId={order.id} token={token} /> : null}
      </div>

      <aside className="space-y-6 lg:col-span-5">
        <section aria-labelledby="items-heading" className="space-y-4 rounded-2xl bg-plaster p-5 sm:p-6">
          <h2 id="items-heading" className="font-display text-2xl">
            Items
          </h2>
          <ul className="divide-y divide-line">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-4 py-3 text-[0.9375rem]">
                <div className="min-w-0">
                  <p className="font-medium">
                    {item.quantity} × {item.productName}
                  </p>
                  {item.variantTitle ? <p className="text-sm text-ink-soft">{item.variantTitle}</p> : null}
                  {Array.isArray(item.personalization)
                    ? (item.personalization as { label: string; value: string }[]).map((p) => (
                        <p key={p.label} className="text-sm text-ink-soft">
                          {p.label}: <span className="whitespace-pre-line text-ink">{p.value}</span>
                        </p>
                      ))
                    : null}
                  {item.madeToOrder ? <p className="text-sm text-wax-ink">Made to order</p> : null}
                </div>
                <p className="shrink-0">{fmt(item.lineTotal)}</p>
              </li>
            ))}
          </ul>
          <dl className="space-y-2 border-t border-line pt-3 text-[0.9375rem]">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>{fmt(order.subtotal)}</dd>
            </div>
            {order.discountTotal ? (
              <div className="flex justify-between text-olive">
                <dt>Discount{order.discountCode ? ` (${order.discountCode})` : ""}</dt>
                <dd>−{fmt(order.discountTotal)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt>{order.fulfillmentMethod === "PICKUP" ? "Pickup" : "Delivery"}</dt>
              <dd>{order.deliveryFee ? fmt(order.deliveryFee) : "Free"}</dd>
            </div>
            {order.taxTotal ? (
              <div className="flex justify-between text-ink-soft">
                <dt>Tax{order.taxIncluded ? " (included)" : ""}</dt>
                <dd>{fmt(order.taxTotal)}</dd>
              </div>
            ) : null}
            {order.refundedTotal ? (
              <div className="flex justify-between text-ink-soft">
                <dt>Refunded</dt>
                <dd>−{fmt(order.refundedTotal)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-line pt-2 text-lg font-medium">
              <dt>Total</dt>
              <dd>{fmt(order.total)}</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="fulfillment-heading" className="space-y-2 rounded-2xl ring-1 ring-line p-5 text-[0.9375rem] sm:p-6">
          <h2 id="fulfillment-heading" className="font-display text-xl">
            {order.fulfillmentMethod === "PICKUP" ? "Pickup" : "Delivery address"}
          </h2>
          {order.fulfillmentMethod === "DELIVERY" ? (
            <address className="not-italic leading-relaxed">
              {order.shipRecipient}
              <br />
              {order.shipLine1}
              {order.shipLine2 ? (
                <>
                  <br />
                  {order.shipLine2}
                </>
              ) : null}
              <br />
              {[order.shipCity, order.shipRegion].filter(Boolean).join(", ")}
              <br />
              {order.shipPhone}
              {order.deliveryZoneName ? <span className="block text-ink-soft">Area: {order.deliveryZoneName}</span> : null}
            </address>
          ) : (
            <p className="text-ink-soft">We&apos;ll let you know when your order is ready to collect.</p>
          )}
          <p className="pt-2 text-ink-soft">Contact: {order.email}, {order.phone}</p>
        </section>
      </aside>
    </div>
  );
}
