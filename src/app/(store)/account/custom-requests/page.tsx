import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/money";
import { getCurrency } from "@/lib/settings";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { CUSTOM_REQUEST_STATUS_LABEL, CUSTOM_REQUEST_STATUS_TONE } from "@/lib/requests";

export const metadata: Metadata = { title: "Custom requests" };

export default async function AccountCustomRequestsPage() {
  const user = await requireUser("/account/custom-requests");
  const [requests, currency] = await Promise.all([
    prisma.customRequest.findMany({
      where: { OR: [{ userId: user.id }, ...(user.emailVerifiedAt ? [{ email: user.email }] : [])] },
      orderBy: { createdAt: "desc" },
    }),
    getCurrency(),
  ]);
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-[2.25rem] leading-tight sm:text-title">Custom requests</h1>
        <ButtonLink href="/custom-order" variant="secondary">
          New request
        </ButtonLink>
      </div>
      {requests.length ? (
        <ul className="space-y-3">
          {requests.map((request) => (
            <li key={request.id}>
              <details className="group rounded-2xl bg-plaster">
                <summary className="flex flex-wrap items-center justify-between gap-3 p-5">
                  <span>
                    <span className="block font-medium">
                      {request.number}: {request.productType}
                    </span>
                    <span className="text-sm text-ink-soft">Sent {request.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span>
                  </span>
                  <Badge tone={CUSTOM_REQUEST_STATUS_TONE[request.status]}>{CUSTOM_REQUEST_STATUS_LABEL[request.status]}</Badge>
                </summary>
                <dl className="grid gap-x-6 gap-y-3 border-t border-line p-5 text-[0.9375rem] sm:grid-cols-2">
                  {request.occasion ? (
                    <div>
                      <dt className="text-sm text-ink-soft">Occasion</dt>
                      <dd>{request.occasion}</dd>
                    </div>
                  ) : null}
                  {request.quantity ? (
                    <div>
                      <dt className="text-sm text-ink-soft">Quantity</dt>
                      <dd>{request.quantity}</dd>
                    </div>
                  ) : null}
                  {request.desiredDate ? (
                    <div>
                      <dt className="text-sm text-ink-soft">Needed by</dt>
                      <dd>{request.desiredDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}</dd>
                    </div>
                  ) : null}
                  {request.budgetRange ? (
                    <div>
                      <dt className="text-sm text-ink-soft">Budget</dt>
                      <dd>{request.budgetRange}</dd>
                    </div>
                  ) : null}
                  <div className="sm:col-span-2">
                    <dt className="text-sm text-ink-soft">Details</dt>
                    <dd className="whitespace-pre-line">{request.details}</dd>
                  </div>
                  {request.quotedAmount !== null ? (
                    <div className="rounded-xl bg-white p-4 sm:col-span-2">
                      <dt className="text-sm text-ink-soft">Our quote</dt>
                      <dd className="font-display text-2xl">{formatMoney(request.quotedAmount, currency)}</dd>
                      {request.quoteNote ? <dd className="mt-1 whitespace-pre-line text-ink-soft">{request.quoteNote}</dd> : null}
                    </div>
                  ) : null}
                </dl>
              </details>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No custom requests yet" action={<ButtonLink href="/custom-order">Request a custom piece</ButtonLink>}>
          Wedding favors, corporate gifts, a candle in your colors — tell us what you have in mind.
        </EmptyState>
      )}
    </div>
  );
}
