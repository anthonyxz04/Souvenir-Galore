"use client";

import { useFormStatus } from "react-dom";
import type { ComponentProps } from "react";
import { buttonClass, type ButtonSize, type ButtonVariant } from "./button";

type Props = ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize; pendingLabel?: string };

/** Submit button that disables itself and shows progress while its form is submitting. */
export function SubmitButton({ variant = "primary", size = "md", className, children, pendingLabel, disabled, ...props }: Props) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={buttonClass(variant, size, className)} disabled={pending || disabled} aria-disabled={pending || disabled} {...props}>
      {pending ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />
          <span>{pendingLabel ?? "Working…"}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
