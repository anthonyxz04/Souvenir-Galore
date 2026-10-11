"use client";

import { savePaymentMethodAction } from "@/server/actions/admin/payments";
import type { PaymentMethodType } from "@/lib/domain";
import { PAYMENT_TYPE_INFO } from "@/lib/payments/rules";
import { CheckboxField, InputField, SelectField, TextareaField } from "@/components/ui/field";
import { Notice } from "@/components/ui/form-message";
import { AdminForm } from "./admin-form";

export type PaymentMethodInitial = {
  id?: string;
  type: PaymentMethodType;
  name: string;
  description: string;
  instructions: string;
  isEnabled: boolean;
  requiresManualVerification: boolean;
  allowCustomerReference: boolean;
  availableForDelivery: boolean;
  availableForPickup: boolean;
  minOrderTotal: string;
  maxOrderTotal: string;
  provider: string;
  config: Record<string, string>;
};

export function PaymentMethodForm({ initial, missing, providers }: { initial: PaymentMethodInitial; missing: string[]; providers: { key: string; label: string }[] }) {
  const info = PAYMENT_TYPE_INFO[initial.type];
  const gatewayBlocked = initial.type === "ONLINE_GATEWAY" && providers.length === 0;
  return (
    <AdminForm action={savePaymentMethodAction} submitLabel={initial.id ? "Save payment method" : "Create payment method"}>
      {(state) => {
        const v = state.values ?? {};
        const e = state.fieldErrors ?? {};
        return (
          <div className="grid gap-8 lg:grid-cols-2">
            {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
            <input type="hidden" name="type" value={initial.type} />
            <div className="space-y-5">
              <Notice tone="info" title={info.label}>
                {info.summary}
              </Notice>
              {missing.length ? (
                <Notice tone="warning" title="Before this can be turned on">
                  <ul className="list-disc pl-5">
                    {missing.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </Notice>
              ) : null}
              <InputField name="name" label="Name shown at checkout" required maxLength={60} defaultValue={v.name ?? initial.name} error={e.name} />
              <TextareaField name="description" label="Short description at checkout" optional rows={2} maxLength={300} defaultValue={v.description ?? initial.description} />
              {info.configFields.map((field) => (
                <InputField
                  key={field.key}
                  name={`config.${field.key}`}
                  label={field.label}
                  optional={!field.required}
                  required={field.required}
                  hint={field.help}
                  maxLength={500}
                  defaultValue={v[`config.${field.key}`] ?? initial.config[field.key] ?? ""}
                  autoComplete="off"
                />
              ))}
              {initial.type !== "ONLINE_GATEWAY" ? (
                <TextareaField
                  name="instructions"
                  label="Payment instructions"
                  optional={!info.instructionsRequired}
                  rows={5}
                  maxLength={2000}
                  defaultValue={v.instructions ?? initial.instructions}
                  hint={
                    initial.type === "WHISH_MONEY"
                      ? "Shown after the order is placed and in the confirmation email, with the account details above. Tell customers what to send, and to enter the transaction reference on their order page."
                      : initial.type === "CASH_ON_DELIVERY"
                        ? "Optional, e.g. “Please have the exact amount ready.”"
                        : "Shown after the order is placed and in the confirmation email."
                  }
                />
              ) : null}
              {initial.type === "ONLINE_GATEWAY" ? (
                gatewayBlocked ? (
                  <Notice tone="warning" title="No gateway integration installed">
                    A developer needs to add an official provider integration in <code>src/lib/payments/providers</code> and set its credentials before an online gateway can be used.
                  </Notice>
                ) : (
                  <SelectField name="provider" label="Provider" defaultValue={initial.provider} placeholder="Choose a provider" options={providers.map((p) => ({ value: p.key, label: p.label }))} />
                )
              ) : null}
            </div>
            <div className="space-y-5">
              <CheckboxField
                name="isEnabled"
                label="Offer this method at checkout"
                defaultChecked={initial.isEnabled}
                disabled={gatewayBlocked}
                error={e.isEnabled}
                hint={missing.length ? "You can save details now and turn it on once everything required is filled in." : undefined}
              />
              {initial.type === "WHISH_MONEY" || initial.type === "MANUAL" ? (
                <CheckboxField name="allowCustomerReference" label="Ask customers for their transaction reference" defaultChecked={initial.allowCustomerReference} hint="Customers submit it from their order page. The order then waits for your verification." />
              ) : null}
              {initial.type === "ONLINE_GATEWAY" ? (
                <CheckboxField name="requiresManualVerification" label="Also require manual verification" defaultChecked={initial.requiresManualVerification} />
              ) : (
                <input type="hidden" name="requiresManualVerification" value="on" />
              )}
              <fieldset className="space-y-2">
                <legend className="mb-1 text-sm font-medium">Available for</legend>
                <CheckboxField name="availableForDelivery" label="Delivery orders" defaultChecked={initial.availableForDelivery} />
                <CheckboxField name="availableForPickup" label="Pickup orders" defaultChecked={initial.availableForPickup} />
              </fieldset>
              <div className="grid gap-4 sm:grid-cols-2">
                <InputField name="minOrderTotal" label="Minimum order total" optional inputMode="decimal" defaultValue={v.minOrderTotal ?? initial.minOrderTotal} error={e.minOrderTotal} />
                <InputField name="maxOrderTotal" label="Maximum order total" optional inputMode="decimal" defaultValue={v.maxOrderTotal ?? initial.maxOrderTotal} error={e.maxOrderTotal} />
              </div>
              <p className="text-[0.8125rem] text-ink-soft">
                Orders paid with manual methods start as “Awaiting payment”. Customers can report a payment, but an order is marked paid only when someone with permission confirms it on the order page.
              </p>
            </div>
          </div>
        );
      }}
    </AdminForm>
  );
}
