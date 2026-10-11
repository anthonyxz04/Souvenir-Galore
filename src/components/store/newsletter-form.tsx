"use client";

import { useActionState } from "react";
import { subscribeNewsletterAction } from "@/server/actions/public";
import { initialFormState } from "@/lib/validation/forms";
import { CheckboxField } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SpamFields } from "@/components/ui/spam-fields";
import { SubmitButton } from "@/components/ui/submit-button";

export function NewsletterForm({ consentText, source }: { consentText: string; source: string }) {
  const [state, action] = useActionState(subscribeNewsletterAction, initialFormState);
  if (state.status === "success") return <FormMessage state={state} />;
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="source" value={source} />
      <SpamFields />
      <div className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor="newsletter-email" className="sr-only">
          Email address
        </label>
        <input
          id="newsletter-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          defaultValue={state.values?.email}
          aria-invalid={state.fieldErrors?.email ? true : undefined}
          aria-describedby={state.fieldErrors?.email ? "newsletter-email-error" : undefined}
          className="h-12 min-w-0 flex-1 rounded-full border border-line-strong/70 bg-plaster px-5 text-base focus:border-olive focus:outline-none"
        />
        <SubmitButton size="lg" pendingLabel="Subscribing…">
          Subscribe
        </SubmitButton>
      </div>
      {state.fieldErrors?.email ? (
        <p id="newsletter-email-error" className="text-sm text-wine">
          {state.fieldErrors.email}
        </p>
      ) : null}
      <CheckboxField name="consent" label={consentText} error={state.fieldErrors?.consent} />
      <FormMessage state={state} />
    </form>
  );
}
