import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guards";
import { toMajorString } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { deleteDiscountAction } from "@/server/actions/admin/sales";
import { AdminPageHeader, Panel } from "@/components/admin/admin-ui";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { DiscountForm } from "@/components/admin/sales-forms";

export const metadata: Metadata = { title: "Edit discount" };

export default async function EditDiscountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStaffPage("discounts:manage", `/admin/discounts/${id}`);
  const [discount, commerce] = await Promise.all([prisma.discount.findUnique({ where: { id }, include: { _count: { select: { orders: true } } } }), getSettings("commerce")]);
  if (!discount) notFound();
  const d = commerce.currencyDecimals;
  return (
    <div>
      <AdminPageHeader
        back={{ href: "/admin/discounts", label: "Discounts" }}
        title={discount.code}
        description={`Used ${discount.usageCount} time${discount.usageCount === 1 ? "" : "s"}.`}
        actions={
          <ConfirmButton
            action={deleteDiscountAction}
            fields={{ id }}
            label="Delete"
            title={`Delete ${discount.code}?`}
            description={discount._count.orders ? "This code was used in orders, so it will be paused instead of deleted." : "Customers will no longer be able to use this code."}
            confirmLabel={discount._count.orders ? "Pause code" : "Delete code"}
          />
        }
      />
      <Panel>
        <DiscountForm
          currencyCode={commerce.currencyCode}
          initial={{
            id: discount.id,
            code: discount.code,
            description: discount.description ?? "",
            type: discount.type,
            value: discount.type === "PERCENTAGE" ? String(discount.value) : discount.type === "FIXED_AMOUNT" ? toMajorString(discount.value, d) : "",
            maxDiscountAmount: discount.maxDiscountAmount !== null ? toMajorString(discount.maxDiscountAmount, d) : "",
            minSubtotal: discount.minSubtotal !== null ? toMajorString(discount.minSubtotal, d) : "",
            startsAt: discount.startsAt?.toISOString() ?? "",
            endsAt: discount.endsAt?.toISOString() ?? "",
            usageLimit: discount.usageLimit !== null ? String(discount.usageLimit) : "",
            perCustomerLimit: discount.perCustomerLimit !== null ? String(discount.perCustomerLimit) : "",
            isActive: discount.isActive,
          }}
        />
      </Panel>
    </div>
  );
}
