import type { Metadata } from "next";
import { requireStaffPage } from "@/lib/auth/guards";
import { AdminPageHeader, Panel } from "@/components/admin/admin-ui";
import { PageForm } from "@/components/admin/content-forms";

export const metadata: Metadata = { title: "New page" };

export default async function NewPage() {
  await requireStaffPage("content:manage", "/admin/pages/new");
  return (
    <div>
      <AdminPageHeader back={{ href: "/admin/pages", label: "Pages & policies" }} title="New page" />
      <Panel>
        <PageForm initial={{ title: "", slug: "", body: "", footerGroup: "help", position: 0, seoTitle: "", seoDescription: "", isPublished: false, showInFooter: true, needsOwnerReview: false }} />
      </Panel>
    </div>
  );
}
