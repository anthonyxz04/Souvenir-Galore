import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guards";
import { deletePageAction } from "@/server/actions/admin/content";
import { AdminPageHeader, Panel } from "@/components/admin/admin-ui";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { PageForm } from "@/components/admin/content-forms";
import { Notice } from "@/components/ui/form-message";

export const metadata: Metadata = { title: "Edit page" };
const PROTECTED = ["about", "privacy-policy", "terms-and-conditions", "returns-and-refunds", "delivery-and-pickup", "custom-order-policy"];

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStaffPage("content:manage", `/admin/pages/${id}`);
  const page = await prisma.page.findUnique({ where: { id } });
  if (!page) notFound();
  return (
    <div className="space-y-6">
      <AdminPageHeader
        back={{ href: "/admin/pages", label: "Pages & policies" }}
        title={page.title}
        actions={
          <>
            <Link href={page.slug === "about" ? "/about" : `/pages/${page.slug}`} target="_blank" className="text-sm underline underline-offset-4">
              View page
            </Link>
            {!PROTECTED.includes(page.slug) ? <ConfirmButton action={deletePageAction} fields={{ id }} label="Delete" title={`Delete ${page.title}?`} description="Links to this page will stop working." confirmLabel="Delete page" /> : null}
          </>
        }
      />
      {page.needsOwnerReview ? <Notice tone="warning">This is a starting template. Replace anything that doesn&apos;t match how your business works, then untick “Needs owner review”.</Notice> : null}
      <Panel>
        <PageForm
          initial={{
            id: page.id,
            title: page.title,
            slug: page.slug,
            body: page.body,
            footerGroup: page.footerGroup ?? "help",
            position: page.position,
            seoTitle: page.seoTitle ?? "",
            seoDescription: page.seoDescription ?? "",
            isPublished: page.isPublished,
            showInFooter: page.showInFooter,
            needsOwnerReview: page.needsOwnerReview,
          }}
        />
      </Panel>
    </div>
  );
}
