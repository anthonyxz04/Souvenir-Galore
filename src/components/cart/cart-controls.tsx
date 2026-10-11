"use client";

import { useActionState, useRef } from "react";
import { applyDiscountAction, removeDiscountAction, updateCartQuantityAction } from "@/server/actions/cart";
import { initialFormState } from "@/lib/validation/forms";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";

/** Quantity picker that saves as soon as it changes (with a button fallback when JavaScript is off). */
export function QuantityForm({ itemId, quantity, max, label }: { itemId: string; quantity: number; max: number | null; label: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const limit = Math.max(quantity, Math.min(max ?? 50, 50));
  return (
    <form ref={formRef} action={updateCartQuantityAction} className="flex items-center gap-2">
      <input type="hidden" name="itemId" value={itemId} />
      <label htmlFor={`qty-${itemId}`} className="sr-only">
        Quantity for {label}
      </label>
      <select
        id={`qty-${itemId}`}
        name="quantity"
        defaultValue={quantity}
        onChange={() => formRef.current?.requestSubmit()}
        className="h-10 rounded-full border border-line-strong/70 bg-plaster pl-4 pr-8 text-sm focus:border-olive focus:outline-none"
      >
        {Array.from({ length: limit }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" className="text-sm underline">
          Update
        </button>
      </noscript>
    </form>
  );
}

export function DiscountForm({ appliedCode }: { appliedCode: string | null }) {
  const [state, action] = useActionState(applyDiscountAction, initialFormState);
  if (appliedCode) {
    return (
      <form action={removeDiscountAction} className="flex items-center justify-between gap-3 rounded-xl bg-limestone px-4 py-2.5 text-sm">
        <span>
          Code <strong className="font-semibold">{appliedCode}</strong>
        </span>
        <button type="submit" className="text-ink-soft underline underline-offset-4 hover:text-ink">
          Remove
        </button>
      </form>
    );
  }
  return (
    <form action={action} className="space-y-2">
      <label htmlFor="discount-code" className="text-sm font-medium text-ink">
        Discount code
      </label>
      <div className="flex gap-2">
        <input
          id="discount-code"
          name="code"
          autoComplete="off"
          autoCapitalize="characters"
          className="h-11 min-w-0 flex-1 rounded-full border border-line-strong/70 bg-white px-4 text-[0.9375rem] uppercase focus:border-olive focus:outline-none"
        />
        <SubmitButton variant="secondary" pendingLabel="Checking…">
          Apply
        </SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
