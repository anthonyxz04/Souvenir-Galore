"use client";

import { saveDiscountAction, updateCustomRequestAction, updateInquiryAction } from "@/server/actions/admin/sales";
import { CUSTOM_REQUEST_STATUS_LABEL } from "@/lib/requests";
import { CUSTOM_REQUEST_STATUSES } from "@/lib/domain";
import { CheckboxField, InputField, SelectField, TextareaField } from "@/components/ui/field";
import { AdminForm } from "./admin-form";
import { LocalDateTimeInput } from "./local-datetime-input";
import { useState } from "react";

export function CustomRequestForm({ request }: { request: { id: string; status: string; quotedAmount: string; quoteNote: string; adminNotes: string } }) {
  return (
    <AdminForm action={updateCustomRequestAction} submitLabel="Save">
      {(state) => (
        <>
          <input type="hidden" name="id" value={request.id} />
          <SelectField name="status" label="Status" defaultValue={request.status} options={CUSTOM_REQUEST_STATUSES.map((s) => ({ value: s, label: CUSTOM_REQUEST_STATUS_LABEL[s] }))} />
          <InputField name="quotedAmount" label="Quote" optional inputMode="decimal" defaultValue={state.values?.quotedAmount ?? request.quotedAmount} error={state.fieldErrors?.quotedAmount} hint="Total price you're offering." />
          <TextareaField name="quoteNote" label="Note for the customer" optional rows={3} defaultValue={state.values?.quoteNote ?? request.quoteNote} hint="Included in the quote email: timing, deposit, what's included." />
          <CheckboxField name="sendQuote" label="Email this quote to the customer" />
          <TextareaField name="adminNotes" label="Internal notes" optional rows={4} defaultValue={state.values?.adminNotes ?? request.adminNotes} hint="Only staff can see these." />
        </>
      )}
    </AdminForm>
  );
}

export function InquiryForm({ inquiry }: { inquiry: { id: string; status: string; adminNotes: string } }) {
  return (
    <AdminForm action={updateInquiryAction} submitLabel="Save">
      {() => (
        <>
          <input type="hidden" name="id" value={inquiry.id} />
          <SelectField
            name="status"
            label="Status"
            defaultValue={inquiry.status}
            options={[
              { value: "NEW", label: "New" },
              { value: "IN_PROGRESS", label: "In progress" },
              { value: "RESOLVED", label: "Resolved" },
              { value: "SPAM", label: "Spam" },
            ]}
          />
          <TextareaField name="adminNotes" label="Internal notes" optional rows={3} defaultValue={inquiry.adminNotes} />
        </>
      )}
    </AdminForm>
  );
}

type DiscountInitial = {
  id?: string;
  code?: string;
  description?: string;
  type?: string;
  value?: string;
  maxDiscountAmount?: string;
  minSubtotal?: string;
  startsAt?: string;
  endsAt?: string;
  usageLimit?: string;
  perCustomerLimit?: string;
  isActive?: boolean;
};

export function DiscountForm({ initial, currencyCode }: { initial: DiscountInitial; currencyCode: string }) {
  const [type, setType] = useState(initial.type ?? "PERCENTAGE");
  return (
    <AdminForm action={saveDiscountAction} submitLabel={initial.id ? "Save discount" : "Create discount"}>
      {(state) => {
        const v = state.values ?? {};
        const e = state.fieldErrors ?? {};
        return (
          <div className="grid gap-5 lg:grid-cols-2">
            {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
            <div className="space-y-5">
              <InputField name="code" label="Code" required maxLength={40} defaultValue={v.code ?? initial.code} error={e.code} hint="Customers type this at checkout. Letters and numbers, e.g. MOTHERSDAY15." className="uppercase" />
              <InputField name="description" label="Internal description" optional maxLength={200} defaultValue={v.description ?? initial.description} />
              <SelectField
                name="type"
                label="Discount"
                value={type}
                onChange={(event) => setType(event.target.value)}
                options={[
                  { value: "PERCENTAGE", label: "Percentage off" },
                  { value: "FIXED_AMOUNT", label: `Fixed amount off (${currencyCode})` },
                  { value: "FREE_DELIVERY", label: "Free delivery" },
                ]}
              />
              {type !== "FREE_DELIVERY" ? (
                <InputField name="value" label={type === "PERCENTAGE" ? "Percentage" : `Amount (${currencyCode})`} required inputMode="decimal" defaultValue={v.value ?? initial.value} error={e.value} />
              ) : null}
              {type === "PERCENTAGE" ? <InputField name="maxDiscountAmount" label="Maximum discount" optional inputMode="decimal" defaultValue={v.maxDiscountAmount ?? initial.maxDiscountAmount} error={e.maxDiscountAmount} /> : null}
              <InputField name="minSubtotal" label="Minimum spend" optional inputMode="decimal" defaultValue={v.minSubtotal ?? initial.minSubtotal} error={e.minSubtotal} />
            </div>
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <LocalDateTimeInput name="startsAt" label="Starts" defaultIso={v.startsAt || initial.startsAt} error={e.startsAt} />
                <LocalDateTimeInput name="endsAt" label="Ends" defaultIso={v.endsAt || initial.endsAt} error={e.endsAt} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <InputField name="usageLimit" label="Total uses" optional type="number" min={1} defaultValue={v.usageLimit ?? initial.usageLimit} error={e.usageLimit} hint="Empty = unlimited" />
                <InputField name="perCustomerLimit" label="Uses per customer" optional type="number" min={1} defaultValue={v.perCustomerLimit ?? initial.perCustomerLimit} error={e.perCustomerLimit} hint="By email or account" />
              </div>
              <CheckboxField name="isActive" label="Active" defaultChecked={initial.isActive ?? true} />
            </div>
          </div>
        );
      }}
    </AdminForm>
  );
}
