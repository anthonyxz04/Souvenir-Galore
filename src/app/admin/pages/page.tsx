import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guards";
import { AdminPageHeader, EmptyRow, formatDate, Table, Td, Th } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/form-message";

export const metadata: Metadata = { title: "Pages & policies" };

export default async function PagesAdmin() {
  await requireStaffPage("content:manage", "/admin/pages");
  const pages = await prisma.page.findMany({ orderBy: [{ footerGroup: "asc" }, { position: "asc" }, { title: "asc" }] });
  const needsReview = pages.filter((p) => p.needsOwnerReview);
  return (
    <div className="space-y-6">
      <AdminPageHeader title="Pages & policies" description="About, delivery, returns, privacy, terms and any other page." actions={<ButtonLink href="/admin/pages/new" size="sm">Add page</ButtonLink>} />
      {needsReview.length ? (
        <Notice tone="warning" title={`${needsReview.length} page${needsReview.length > 1 ? "s" : ""} need your review before launch`}>
          These were written as starting templates. Check every detail (delivery fees, return windows, legal wording) matches how your business actually works, then untick “Needs owner review”. Consider asking a lawyer to review the privacy policy and terms.
        </Notice>
      ) : null}
      <Table>
        <thead>
          <tr>
            <Th>Page</Th>
            <Th>Footer</Th>
            <Th>Status</Th>
            <Th>Updated</Th>
          </tr>
        </thead>
        <tbody>
          {pages.length ? (
            pages.map((page) => (
              <tr key={page.id}>
                <Td>
                  <Link href={`/admin/pages/${page.id}`} className="font-medium hover:underline">
                    {page.title}
                  </Link>
                  <p className="text-xs text-ink-soft">{page.slug === "about" ? "/about" : `/pages/${page.slug}`}</p>
                </Td>
                <Td className="text-sm">{page.showInFooter ? (page.footerGroup === "policies" ? "Policies" : "Help") : "—"}</Td>
                <Td className="space-x-1">
                  <Badge tone={page.isPublished ? "success" : "neutral"}>{page.isPublished ? "Published" : "Hidden"}</Badge>
                  {page.needsOwnerReview ? <Badge tone="warning">Review</Badge> : null}
                </Td>
                <Td className="text-sm text-ink-soft">{formatDate(page.updatedAt)}</Td>
              </tr>
            ))
          ) : (
            <EmptyRow colSpan={4}>No pages yet.</EmptyRow>
          )}
        </tbody>
      </Table>
    </div>
  );
}
