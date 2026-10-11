import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guards";
import { describeDiscount } from "@/lib/discounts/evaluate";
import { formatMoney } from "@/lib/money";
import { getCurrency } from "@/lib/settings";
import { toggleDiscountAction } from "@/server/actions/admin/sales";
import { AdminPageHeader, EmptyRow, formatDate, Table, Td, Th } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Discounts" };

export default async function DiscountsPage() {
  await requireStaffPage("discounts:manage", "/admin/discounts");
  const [discounts, currency] = await Promise.all([prisma.discount.findMany({ orderBy: { createdAt: "desc" } }), getCurrency()]);
  const fmt = (m: number) => formatMoney(m, currency);
  const now = new Date();
  return (
    <div>
      <AdminPageHeader title="Discounts" description="Codes customers enter in their cart. Combine with a promotional banner on the homepage to announce a sale." actions={<ButtonLink href="/admin/discounts/new" size="sm">Create discount</ButtonLink>} />
      <Table>
        <thead>
          <tr>
            <Th>Code</Th>
            <Th>Offer</Th>
            <Th>Conditions</Th>
            <Th>Used</Th>
            <Th>Status</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {discounts.length ? (
            discounts.map((d) => {
              const expired = d.endsAt && d.endsAt < now;
              const scheduled = d.startsAt && d.startsAt > now;
              const exhausted = d.usageLimit !== null && d.usageCount >= d.usageLimit;
              const live = d.isActive && !expired && !scheduled && !exhausted;
              return (
                <tr key={d.id}>
                  <Td>
                    <Link href={`/admin/discounts/${d.id}`} className="font-mono font-medium hover:underline">
                      {d.code}
                    </Link>
                    {d.description ? <p className="text-xs text-ink-soft">{d.description}</p> : null}
                  </Td>
                  <Td>{describeDiscount(d, fmt)}</Td>
                  <Td className="text-sm text-ink-soft">
                    {[d.minSubtotal ? `Min. ${fmt(d.minSubtotal)}` : null, d.perCustomerLimit ? `${d.perCustomerLimit} per customer` : null, d.startsAt || d.endsAt ? `${formatDate(d.startsAt)} – ${formatDate(d.endsAt)}` : null].filter(Boolean).join(", ") || "None"}
                  </Td>
                  <Td className="tabular-nums">
                    {d.usageCount}
                    {d.usageLimit ? ` / ${d.usageLimit}` : ""}
                  </Td>
                  <Td>
                    <Badge tone={live ? "success" : "neutral"}>{live ? "Live" : !d.isActive ? "Paused" : expired ? "Expired" : scheduled ? "Scheduled" : "Used up"}</Badge>
                  </Td>
                  <Td>
                    <form action={toggleDiscountAction}>
                      <input type="hidden" name="id" value={d.id} />
                      <button type="submit" className="text-sm underline underline-offset-4">
                        {d.isActive ? "Pause" : "Activate"}
                      </button>
                    </form>
                  </Td>
                </tr>
              );
            })
          ) : (
            <EmptyRow colSpan={6}>No discount codes yet.</EmptyRow>
          )}
        </tbody>
      </Table>
    </div>
  );
}
