import type { Metadata } from "next";
import { requireStaffPage } from "@/lib/auth/guards";
import { getSettings } from "@/lib/settings";
import { AdminPageHeader, Panel } from "@/components/admin/admin-ui";
import { DiscountForm } from "@/components/admin/sales-forms";

export const metadata: Metadata = { title: "New discount" };

export default async function NewDiscountPage() {
  await requireStaffPage("discounts:manage", "/admin/discounts/new");
  const commerce = await getSettings("commerce");
  return (
    <div>
      <AdminPageHeader back={{ href: "/admin/discounts", label: "Discounts" }} title="New discount" />
      <Panel>
        <DiscountForm initial={{}} currencyCode={commerce.currencyCode} />
      </Panel>
    </div>
  );
}
