"use client";

import { useActionState } from "react";
import { adjustStockAction } from "@/server/actions/admin/products";
import { initialFormState } from "@/lib/validation/forms";
import { SubmitButton } from "@/components/ui/submit-button";

export function StockAdjustForm({ variantId, label }: { variantId: string; label: string }) {
  const [state, action] = useActionState(adjustStockAction, initialFormState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2" key={state.status === "success" ? state.message : "form"}>
      <input type="hidden" name="variantId" value={variantId} />
      <label className="sr-only" htmlFor={`adj-${variantId}`}>
        Change stock for {label}
      </label>
      <input id={`adj-${variantId}`} name="delta" type="number" placeholder="+/−" className="h-9 w-20 rounded-lg border border-line-strong/70 bg-white px-2 text-sm focus:border-olive focus:outline-none" />
      <label className="sr-only" htmlFor={`reason-${variantId}`}>
        Reason
      </label>
      <select id={`reason-${variantId}`} name="reason" className="h-9 rounded-lg border border-line-strong/70 bg-white px-2 text-sm">
        <option value="RESTOCK">Made / restocked</option>
        <option value="MANUAL_ADJUSTMENT">Correction</option>
        <option value="RETURN">Returned</option>
      </select>
      <SubmitButton size="sm" variant="secondary" pendingLabel="…">
        Apply
      </SubmitButton>
      {state.message ? <span className={state.status === "error" ? "text-xs text-wine" : "text-xs text-olive"} role="status">{state.message}</span> : null}
    </form>
  );
}
