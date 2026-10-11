"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { forgotPasswordAction, registerAction, resetPasswordAction, signInAction } from "@/server/actions/auth";
import { initialFormState } from "@/lib/validation/forms";
import { CheckboxField, InputField } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SpamFields } from "@/components/ui/spam-fields";
import { SubmitButton } from "@/components/ui/submit-button";

function PasswordInput({ name, label, error, autoComplete, hint }: { name: string; label: string; error?: string; autoComplete: string; hint?: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <InputField name={name} label={label} type={visible ? "text" : "password"} autoComplete={autoComplete} required error={error} hint={hint} className="pr-20" maxLength={128} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2 top-[2.05rem] h-9 rounded-full px-3 text-sm text-ink-soft hover:bg-ink/5 hover:text-ink"
        aria-pressed={visible}
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signInAction, initialFormState);
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next ?? ""} />
      <FormMessage state={state} />
      <InputField name="email" label="Email" type="email" autoComplete="email" required defaultValue={state.values?.email} error={state.fieldErrors?.email} />
      <PasswordInput name="password" label="Password" autoComplete="current-password" error={state.fieldErrors?.password} />
      <div className="flex items-center justify-between gap-4">
        <SubmitButton size="lg" pendingLabel="Signing in…">
          Sign in
        </SubmitButton>
        <Link href="/forgot-password" className="text-sm text-olive underline underline-offset-4">
          Forgot your password?
        </Link>
      </div>
    </form>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const [state, action] = useActionState(registerAction, initialFormState);
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next ?? ""} />
      <SpamFields />
      <FormMessage state={state} />
      <InputField name="name" label="Full name" autoComplete="name" required defaultValue={state.values?.name} error={state.fieldErrors?.name} maxLength={100} />
      <InputField name="email" label="Email" type="email" autoComplete="email" required defaultValue={state.values?.email} error={state.fieldErrors?.email} />
      <InputField name="phone" label="Phone" type="tel" autoComplete="tel" optional hint="For delivery questions only." defaultValue={state.values?.phone} error={state.fieldErrors?.phone} />
      <PasswordInput name="password" label="Password" autoComplete="new-password" error={state.fieldErrors?.password} hint="At least 10 characters. A short phrase is easy to remember." />
      <CheckboxField name="marketingOptIn" label="Send me news about new collections and offers (optional)." defaultChecked={state.values?.marketingOptIn === "on"} />
      <p className="text-sm text-ink-soft">
        By creating an account you agree to our{" "}
        <Link href="/pages/terms-and-conditions" className="underline underline-offset-4">
          terms
        </Link>{" "}
        and{" "}
        <Link href="/pages/privacy-policy" className="underline underline-offset-4">
          privacy policy
        </Link>
        .
      </p>
      <SubmitButton size="lg" pendingLabel="Creating account…">
        Create account
      </SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(forgotPasswordAction, initialFormState);
  return (
    <form action={action} className="space-y-5" noValidate>
      <FormMessage state={state} />
      {state.status !== "success" ? (
        <>
          <InputField name="email" label="Email" type="email" autoComplete="email" required defaultValue={state.values?.email} error={state.fieldErrors?.email} />
          <SubmitButton size="lg" pendingLabel="Sending…">
            Send reset link
          </SubmitButton>
        </>
      ) : null}
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, initialFormState);
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      <PasswordInput name="password" label="New password" autoComplete="new-password" error={state.fieldErrors?.password} hint="At least 10 characters." />
      <PasswordInput name="confirmPassword" label="Repeat new password" autoComplete="new-password" error={state.fieldErrors?.confirmPassword} />
      <SubmitButton size="lg" pendingLabel="Saving…">
        Save new password
      </SubmitButton>
    </form>
  );
}
