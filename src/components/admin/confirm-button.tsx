"use client";

import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { buttonClass, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";

/**
 * A destructive or important action that asks for confirmation in a dialog,
 * then submits a Server Action form with the given hidden fields.
 */
export function ConfirmButton({
  action,
  fields,
  label,
  title,
  description,
  confirmLabel,
  variant = "secondary",
  confirmVariant = "danger",
  size = "sm",
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  fields: Record<string, string>;
  label: ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  variant?: ButtonVariant;
  confirmVariant?: ButtonVariant;
  size?: ButtonSize;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={buttonClass(variant, size)}>{label}</DialogTrigger>
      <DialogContent title={title} description={description}>
        <form
          action={async (formData) => {
            await action(formData);
            setOpen(false);
          }}
          className="space-y-4"
        >
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          {children}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className={buttonClass("ghost", "md")}>
              Keep it
            </button>
            <SubmitButton variant={confirmVariant} pendingLabel="Working…">
              {confirmLabel}
            </SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
