import type { Metadata } from "next";
import { requireStaffPage } from "@/lib/auth/guards";
import { PAYMENT_METHOD_TYPES, type PaymentMethodType } from "@/lib/domain";
import { registeredProviders } from "@/lib/payments/providers";
import { PAYMENT_TYPE_INFO } from "@/lib/payments/rules";
import { AdminPageHeader, Panel } from "@/components/admin/admin-ui";
import { PaymentMethodForm } from "@/components/admin/payment-method-form";

export const metadata: Metadata = { title: "New payment method" };

export default async function NewPaymentMethodPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  await requireStaffPage("payment-methods:manage", "/admin/payments/new");
  const { type: rawType } = await searchParams;
  const type: PaymentMethodType = (PAYMENT_METHOD_TYPES as readonly string[]).includes(rawType ?? "") ? (rawType as PaymentMethodType) : "MANUAL";
  const info = PAYMENT_TYPE_INFO[type];
  return (
    <div>
      <AdminPageHeader back={{ href: "/admin/payments", label: "Payments" }} title={`New: ${info.label}`} />
      <Panel>
        <PaymentMethodForm
          providers={registeredProviders().map((p) => ({ key: p.key, label: p.label }))}
          missing={[]}
          initial={{
            type,
            name: type === "WHISH_MONEY" ? "Whish Money" : type === "CASH_ON_DELIVERY" ? "Cash on delivery" : type === "ONLINE_GATEWAY" ? "Card payment" : "Bank transfer",
            description: "",
            instructions: "",
            isEnabled: false,
            requiresManualVerification: info.defaultRequiresManualVerification,
            allowCustomerReference: info.defaultAllowCustomerReference,
            availableForDelivery: true,
            availableForPickup: true,
            minOrderTotal: "",
            maxOrderTotal: "",
            provider: "",
            config: {},
          }}
        />
      </Panel>
    </div>
  );
}
