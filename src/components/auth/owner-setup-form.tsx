"use client";

import { useActionState, useState } from "react";
import { createFirstOwnerAction } from "@/server/actions/setup";
import { initialFormState } from "@/lib/validation/forms";
import { InputField } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";

export function OwnerSetupForm({ token }: { token: string }) {
  const [state, action] = useActionState(createFirstOwnerAction, initialFormState);
  const [visible, setVisible] = useState(false);
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      <InputField name="name" label="Your name" autoComplete="name" required defaultValue={state.values?.name} error={state.fieldErrors?.name} />
      <InputField name="email" label="Email" type="email" autoComplete="email" required defaultValue={state.values?.email} error={state.fieldErrors?.email} />
      <div className="relative">
        <InputField
          name="password"
          label="Password"
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          required
          maxLength={128}
          className="pr-20"
          hint="At least 10 characters. Use one you don't use anywhere else."
          error={state.fieldErrors?.password}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2 top-[2.05rem] h-9 rounded-full px-3 text-sm text-ink-soft hover:bg-ink/5 hover:text-ink"
          aria-pressed={visible}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      <SubmitButton size="lg" pendingLabel="Creating your account…">
        Create owner account
      </SubmitButton>
    </form>
  );
}
