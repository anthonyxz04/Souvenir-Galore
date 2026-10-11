"use client";

import { useActionState, type ReactNode } from "react";
import { initialFormState, type FormState } from "@/lib/validation/forms";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";

/**
 * Standard admin form (use from client components — it takes a render function).
 * Runs a Server Action, shows success/error messages and
 * passes field errors to children via a render function.
 */
export function AdminForm({
  action,
  children,
  submitLabel = "Save changes",
  className,
  footer,
  resetOnSuccess,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  children: (state: FormState) => ReactNode;
  submitLabel?: string;
  className?: string;
  footer?: ReactNode;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  return (
    <form action={formAction} className={cn("space-y-5", className)} noValidate key={resetOnSuccess && state.status === "success" ? String(Date.now()) : undefined}>
      <FormMessage state={state} />
      {children(state)}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <SubmitButton pendingLabel="Saving…">{submitLabel}</SubmitButton>
        {footer}
      </div>
    </form>
  );
}

export function Toggle({ name, label, description, defaultChecked, disabled }: { name: string; label: ReactNode; description?: ReactNode; defaultChecked?: boolean; disabled?: boolean }) {
  return (
    <label className={cn("flex cursor-pointer items-start justify-between gap-4 rounded-xl py-1", disabled && "cursor-not-allowed opacity-60")}>
      <span className="space-y-0.5">
        <span className="block text-[0.9375rem] font-medium text-ink">{label}</span>
        {description ? <span className="block text-[0.8125rem] text-ink-soft">{description}</span> : null}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" name={name} defaultChecked={defaultChecked} disabled={disabled} className="peer sr-only" role="switch" />
        <span className="h-6 w-11 rounded-full bg-line-strong transition-colors peer-checked:bg-olive peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-olive" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}
