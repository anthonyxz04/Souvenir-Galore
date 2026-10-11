"use client";

import { addOrderNoteAction, recordRefundAction, rejectPaymentAction, updateOrderStatusAction, verifyPaymentAction } from "@/server/actions/admin/orders";
import { CheckboxField, InputField, SelectField, TextareaField } from "@/components/ui/field";
import { AdminForm } from "./admin-form";

export function StatusForm({ orderId, options }: { orderId: string; options: { value: string; label: string }[] }) {
  if (options.length === 0) return <p className="text-sm text-ink-soft">This order is in a final state.</p>;
  return (
    <AdminForm action={updateOrderStatusAction} submitLabel="Update status">
      {(state) => (
        <>
          <input type="hidden" name="orderId" value={orderId} />
          <SelectField name="status" label="Move to" options={options} error={state.fieldErrors?.status} />
          <TextareaField name="note" label="Message" optional rows={2} hint="Shown to the customer in their order history." />
          <CheckboxField name="notify" label="Email the customer about this update" defaultChecked />
        </>
      )}
    </AdminForm>
  );
}

export function VerifyPaymentForm({ orderId, isCash }: { orderId: string; isCash: boolean }) {
  return (
    <AdminForm action={verifyPaymentAction} submitLabel={isCash ? "Record cash received" : "Confirm payment received"}>
      {() => (
        <>
          <input type="hidden" name="orderId" value={orderId} />
          {!isCash ? <InputField name="reference" label="Transaction reference" optional hint="Fill in if the customer didn't submit one." /> : null}
          <TextareaField name="note" label="Internal note" optional rows={2} placeholder="Checked in the Whish app on…" />
          <p className="text-[0.8125rem] text-ink-soft">Only confirm after you&apos;ve seen the money in your account. This is recorded with your name.</p>
        </>
      )}
    </AdminForm>
  );
}

export function RejectPaymentForm({ orderId }: { orderId: string }) {
  return (
    <AdminForm action={rejectPaymentAction} submitLabel="Payment not found">
      {() => (
        <>
          <input type="hidden" name="orderId" value={orderId} />
          <TextareaField name="reason" label="What should the customer check?" optional rows={2} placeholder="We couldn't find a transfer with this reference." hint="The customer is emailed and can submit the reference again." />
        </>
      )}
    </AdminForm>
  );
}

export function RefundForm({ orderId, remaining }: { orderId: string; remaining: string }) {
  return (
    <AdminForm action={recordRefundAction} submitLabel="Record refund">
      {(state) => (
        <>
          <input type="hidden" name="orderId" value={orderId} />
          <InputField name="amount" label="Amount refunded" inputMode="decimal" required hint={`Up to ${remaining}. Record a refund after you've returned the money.`} error={state.fieldErrors?.amount} />
          <TextareaField name="note" label="Reason" optional rows={2} />
        </>
      )}
    </AdminForm>
  );
}

export function NoteForm({ orderId }: { orderId: string }) {
  return (
    <AdminForm action={addOrderNoteAction} submitLabel="Add note" resetOnSuccess>
      {() => (
        <>
          <input type="hidden" name="orderId" value={orderId} />
          <TextareaField name="message" label="Note" required rows={3} />
          <CheckboxField name="visibleToCustomer" label="Show this message to the customer" hint="Leave unticked for internal notes only staff can see." />
          <CheckboxField name="notify" label="Also email it to the customer" />
        </>
      )}
    </AdminForm>
  );
}
