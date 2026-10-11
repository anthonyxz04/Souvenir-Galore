"use client";

import { useActionState } from "react";
import { sendContactMessageAction } from "@/server/actions/public";
import { initialFormState } from "@/lib/validation/forms";
import { InputField, TextareaField } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SpamFields } from "@/components/ui/spam-fields";
import { SubmitButton } from "@/components/ui/submit-button";

export function ContactForm({ defaults }: { defaults: { name?: string; email?: string } }) {
  const [state, action] = useActionState(sendContactMessageAction, initialFormState);
  if (state.status === "success") return <FormMessage state={state} />;
  const v = state.values ?? {};
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-5" noValidate>
      <SpamFields />
      <FormMessage state={state} />
      <div className="grid gap-5 sm:grid-cols-2">
        <InputField name="name" label="Name" required autoComplete="name" defaultValue={v.name ?? defaults.name} error={e.name} />
        <InputField name="email" label="Email" required type="email" autoComplete="email" defaultValue={v.email ?? defaults.email} error={e.email} />
      </div>
      <InputField name="phone" label="Phone" optional type="tel" autoComplete="tel" defaultValue={v.phone} error={e.phone} />
      <InputField name="subject" label="Subject" optional defaultValue={v.subject} error={e.subject} />
      <TextareaField name="message" label="Message" required rows={6} defaultValue={v.message} error={e.message} />
      <SubmitButton size="lg" pendingLabel="Sending…">
        Send message
      </SubmitButton>
    </form>
  );
}
