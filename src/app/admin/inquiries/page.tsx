import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guards";
import { AdminPageHeader, FilterBar, FilterSelect, formatDateTime } from "@/components/admin/admin-ui";
import { InquiryForm } from "@/components/admin/sales-forms";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Messages" };
const STATUS_LABEL: Record<string, string> = { NEW: "New", IN_PROGRESS: "In progress", RESOLVED: "Resolved", SPAM: "Spam" };

export default async function InquiriesPage({ searchParams }: { searchParams: Promise<{ status?: string; open?: string }> }) {
  await requireStaffPage("requests:manage", "/admin/inquiries");
  const { status, open } = await searchParams;
  const where = status && status in STATUS_LABEL ? { status: status as "NEW" } : { status: { not: "SPAM" as const } };
  const inquiries = await prisma.inquiry.findMany({ where, orderBy: { createdAt: "desc" }, take: 100, include: { product: { select: { id: true, slug: true } } } });
  return (
    <div>
      <AdminPageHeader title="Messages" description="Contact-form messages and product questions. These are not orders — reply by email, WhatsApp or phone." />
      <FilterBar>
        <FilterSelect name="status" label="Show" value={status} options={[{ value: "", label: "All except spam" }, ...Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))]} />
      </FilterBar>
      {inquiries.length ? (
        <ul className="space-y-3">
          {inquiries.map((inquiry) => (
            <li key={inquiry.id}>
              <details open={open === inquiry.id} className="rounded-2xl bg-plaster ring-1 ring-line/70">
                <summary className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <span className="min-w-0">
                    <span className="block font-medium">{inquiry.subject ?? (inquiry.type === "PRODUCT" ? `About ${inquiry.productName}` : "Message")}</span>
                    <span className="text-sm text-ink-soft">
                      {inquiry.name}, {formatDateTime(inquiry.createdAt)}
                    </span>
                  </span>
                  <Badge tone={inquiry.status === "NEW" ? "warning" : inquiry.status === "RESOLVED" ? "success" : "neutral"}>{STATUS_LABEL[inquiry.status]}</Badge>
                </summary>
                <div className="grid gap-6 border-t border-line/70 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
                  <div className="space-y-3 text-[0.9375rem]">
                    <p className="whitespace-pre-line">{inquiry.message}</p>
                    {inquiry.type === "PRODUCT" ? (
                      <div className="rounded-xl bg-white/70 p-3 text-sm">
                        <p>
                          Product:{" "}
                          {inquiry.product ? (
                            <Link href={`/admin/products/${inquiry.product.id}`} className="underline">
                              {inquiry.productName}
                            </Link>
                          ) : (
                            inquiry.productName
                          )}
                        </p>
                        {inquiry.variantTitle ? <p>Option: {inquiry.variantTitle}</p> : null}
                        {inquiry.quantity ? <p>Quantity: {inquiry.quantity}</p> : null}
                        {inquiry.personalization && typeof inquiry.personalization === "object" && "text" in inquiry.personalization ? (
                          <p className="whitespace-pre-line">Personalization: {String((inquiry.personalization as { text: string }).text)}</p>
                        ) : null}
                      </div>
                    ) : null}
                    <p className="text-sm">
                      <a href={`mailto:${inquiry.email}?subject=${encodeURIComponent(`Re: ${inquiry.subject ?? "your message"}`)}`} className="text-olive underline">
                        Reply to {inquiry.email}
                      </a>
                      {inquiry.phone ? <span className="text-ink-soft">, phone {inquiry.phone}</span> : null}
                    </p>
                  </div>
                  <InquiryForm inquiry={{ id: inquiry.id, status: inquiry.status, adminNotes: inquiry.adminNotes ?? "" }} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No messages">New contact messages and product questions appear here.</EmptyState>
      )}
    </div>
  );
}
