"use client";

import { useActionState } from "react";
import { resendVerificationAction } from "@/server/actions/auth";
import { initialFormState, type FormState } from "@/lib/validation/forms";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";

export function ResendVerification() {
  const [state, action] = useActionState<FormState>(resendVerificationAction, initialFormState);
  return (
    <form action={action} className="space-y-2">
      {state.status === "idle" ? (
        <SubmitButton variant="link" pendingLabel="Sending…">
          Send a new confirmation link
        </SubmitButton>
      ) : (
        <FormMessage state={state} />
      )}
    </form>
  );
}
