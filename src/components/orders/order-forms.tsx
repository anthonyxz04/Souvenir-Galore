"use client";

import { useActionState } from "react";
import { requestCancellationAction, submitPaymentReferenceAction } from "@/server/actions/orders";
import { initialFormState } from "@/lib/validation/forms";
import { InputField, TextareaField } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";

export function PaymentReferenceForm({ orderId, token, methodName }: { orderId: string; token: string | null; methodName: string }) {
  const [state, action] = useActionState(submitPaymentReferenceAction, initialFormState);
  if (state.status === "success") return <FormMessage state={state} />;
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="token" value={token ?? ""} />
      <FormMessage state={state} />
      <InputField
        name="reference"
        label={`${methodName} transaction reference`}
        required
        maxLength={120}
        hint="The reference or receipt number shown in your app after sending."
        defaultValue={state.values?.reference}
        error={state.fieldErrors?.reference}
      />
      <TextareaField name="note" label="Note" optional rows={2} maxLength={500} defaultValue={state.values?.note} error={state.fieldErrors?.note} placeholder="Sender name, if different from yours" />
      <SubmitButton pendingLabel="Sending…">I&apos;ve sent the payment</SubmitButton>
      <p className="text-[0.8125rem] text-ink-soft">Submitting this doesn&apos;t mark your order as paid — we&apos;ll check that the money arrived first.</p>
    </form>
  );
}

export function CancellationForm({ orderId, token }: { orderId: string; token: string | null }) {
  const [state, action] = useActionState(requestCancellationAction, initialFormState);
  if (state.status === "success") return <FormMessage state={state} />;
  return (
    <details className="group rounded-2xl ring-1 ring-line">
      <summary className="px-4 py-3 text-[0.9375rem] text-ink-soft hover:text-ink">Need to cancel this order?</summary>
      <form action={action} className="space-y-3 px-4 pb-4" noValidate>
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="token" value={token ?? ""} />
        <FormMessage state={state} />
        <TextareaField name="reason" label="Reason" optional rows={2} maxLength={500} />
        <SubmitButton variant="secondary" pendingLabel="Sending…">
          Request cancellation
        </SubmitButton>
      </form>
    </details>
  );
}
