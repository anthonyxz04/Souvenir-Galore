import type { Metadata } from "next";
import { requireStaffPage } from "@/lib/auth/guards";
import { AdminPageHeader, Panel } from "@/components/admin/admin-ui";
import { CollectionForm } from "@/components/admin/catalog-forms";

export const metadata: Metadata = { title: "New collection" };

export default async function NewCollectionPage() {
  await requireStaffPage("catalog:manage", "/admin/collections/new");
  return (
    <div>
      <AdminPageHeader back={{ href: "/admin/collections", label: "Collections" }} title="New collection" description="After creating it, add products here or from each product's page." />
      <Panel>
        <CollectionForm initial={{}} />
      </Panel>
    </div>
  );
}
