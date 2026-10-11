import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guards";
import { moderateReviewAction } from "@/server/actions/admin/sales";
import { AdminPageHeader, FilterBar, FilterSelect, formatDate } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Stars } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Reviews" };

function ActionButton({ id, action, label, danger }: { id: string; action: string; label: string; danger?: boolean }) {
  return (
    <form action={moderateReviewAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="action" value={action} />
      <button type="submit" className={`h-9 rounded-full px-4 text-sm ring-1 ${danger ? "text-wine ring-wine/30 hover:bg-wine-soft" : "ring-ink/20 hover:bg-white"}`}>
        {label}
      </button>
    </form>
  );
}

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireStaffPage("reviews:manage", "/admin/reviews");
  const { status = "PENDING" } = await searchParams;
  const reviews = await prisma.review.findMany({
    where: status === "ALL" ? {} : { status: status as "PENDING" },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { product: { select: { id: true, name: true, slug: true } } },
  });
  return (
    <div>
      <AdminPageHeader
        title="Reviews"
        description="Reviews appear in the store only after you approve them. Featured reviews show as testimonials on the homepage. Never publish reviews that weren't written by real customers."
      />
      <FilterBar>
        <FilterSelect name="status" label="Show" value={status} options={[{ value: "PENDING", label: "Waiting for approval" }, { value: "APPROVED", label: "Approved" }, { value: "REJECTED", label: "Rejected" }, { value: "ALL", label: "All" }]} />
      </FilterBar>
      {reviews.length ? (
        <ul className="space-y-3">
          {reviews.map((review) => (
            <li key={review.id} className="space-y-3 rounded-2xl bg-plaster p-5 ring-1 ring-line/70">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Stars rating={review.rating} />
                  {review.title ? <span className="font-medium">{review.title}</span> : null}
                </div>
                <div className="flex gap-1">
                  <Badge tone={review.status === "APPROVED" ? "success" : review.status === "PENDING" ? "warning" : "neutral"}>{review.status === "APPROVED" ? "Approved" : review.status === "PENDING" ? "Waiting" : "Rejected"}</Badge>
                  {review.isFeatured ? <Badge tone="wax">On homepage</Badge> : null}
                  {review.verifiedPurchase ? <Badge tone="info">Verified purchase</Badge> : null}
                </div>
              </div>
              <p className="whitespace-pre-line text-[0.9375rem]">{review.body}</p>
              <p className="text-sm text-ink-soft">
                {review.authorName}, {formatDate(review.createdAt)}, on{" "}
                <Link href={`/products/${review.product.slug}`} target="_blank" className="underline">
                  {review.product.name}
                </Link>
              </p>
              <div className="flex flex-wrap gap-2">
                {review.status !== "APPROVED" ? <ActionButton id={review.id} action="approve" label="Approve" /> : null}
                {review.status !== "REJECTED" ? <ActionButton id={review.id} action="reject" label="Reject" /> : null}
                {review.isFeatured ? <ActionButton id={review.id} action="unfeature" label="Remove from homepage" /> : review.rating >= 4 ? <ActionButton id={review.id} action="feature" label="Show on homepage" /> : null}
                <ActionButton id={review.id} action="delete" label="Delete" danger />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="Nothing here">Reviews customers write will appear here for approval.</EmptyState>
      )}
    </div>
  );
}
