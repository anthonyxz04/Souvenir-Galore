import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guards";
import { toMajorString } from "@/lib/money";
import { registeredProviderKeys, registeredProviders } from "@/lib/payments/providers";
import { missingRequirements } from "@/lib/payments/rules";
import { getSettings } from "@/lib/settings";
import { deletePaymentMethodAction } from "@/server/actions/admin/payments";
import { AdminPageHeader, Panel } from "@/components/admin/admin-ui";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { PaymentMethodForm } from "@/components/admin/payment-method-form";
import { Notice } from "@/components/ui/form-message";

export const metadata: Metadata = { title: "Payment method" };

export default async function PaymentMethodPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; missing?: string }> }) {
  const { id } = await params;
  await requireStaffPage("payment-methods:manage", `/admin/payments/${id}`);
  const flags = await searchParams;
  const [method, commerce] = await Promise.all([prisma.paymentMethod.findUnique({ where: { id }, include: { _count: { select: { orders: true } } } }), getSettings("commerce")]);
  if (!method) notFound();
  const config = (method.config ?? {}) as Record<string, string>;
  const missing = missingRequirements({ ...method, config }, registeredProviderKeys());
  const d = commerce.currencyDecimals;
  return (
    <div className="space-y-6">
      <AdminPageHeader
        back={{ href: "/admin/payments", label: "Payments" }}
        title={method.name}
        actions={
          <ConfirmButton
            action={deletePaymentMethodAction}
            fields={{ id }}
            label="Delete"
            title={`Delete ${method.name}?`}
            description={method._count.orders ? "It was used for orders, so it will be turned off instead of deleted." : "Customers will no longer see this method."}
            confirmLabel={method._count.orders ? "Turn off" : "Delete"}
          />
        }
      />
      {flags.created ? <Notice tone="success">Payment method created. It stays off until you turn it on.</Notice> : null}
      {flags.missing ? <Notice tone="warning">Fill in the required details below before turning this method on.</Notice> : null}
      <Panel>
        <PaymentMethodForm
          missing={missing}
          providers={registeredProviders().map((p) => ({ key: p.key, label: p.label }))}
          initial={{
            id: method.id,
            type: method.type,
            name: method.name,
            description: method.description ?? "",
            instructions: method.instructions ?? "",
            isEnabled: method.isEnabled,
            requiresManualVerification: method.requiresManualVerification,
            allowCustomerReference: method.allowCustomerReference,
            availableForDelivery: method.availableForDelivery,
            availableForPickup: method.availableForPickup,
            minOrderTotal: method.minOrderTotal !== null ? toMajorString(method.minOrderTotal, d) : "",
            maxOrderTotal: method.maxOrderTotal !== null ? toMajorString(method.maxOrderTotal, d) : "",
            provider: method.provider ?? "",
            config,
          }}
        />
      </Panel>
    </div>
  );
}
