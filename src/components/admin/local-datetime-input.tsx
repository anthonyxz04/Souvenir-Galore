"use client";

import { useEffect, useId, useState } from "react";
import { controlClass } from "@/components/ui/field";

function toLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Date & time picker in the administrator's own time zone. Submits an ISO
 * (UTC) timestamp in a hidden field so the server never guesses the time zone.
 */
export function LocalDateTimeInput({ name, label, defaultIso, error, hint }: { name: string; label: string; defaultIso?: string | null; error?: string; hint?: string }) {
  const id = useId();
  const [local, setLocal] = useState("");
  useEffect(() => setLocal(toLocal(defaultIso)), [defaultIso]);
  const iso = local ? new Date(local).toISOString() : "";
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="flex items-baseline justify-between text-sm font-medium">
        <span>{label}</span>
        <span className="text-xs font-normal text-ink-soft">Optional</span>
      </label>
      <input id={id} type="datetime-local" value={local} onChange={(e) => setLocal(e.target.value)} className={controlClass} aria-invalid={error ? true : undefined} />
      <input type="hidden" name={name} value={iso} />
      {hint ? <p className="text-[0.8125rem] text-ink-soft">{hint}</p> : null}
      {error ? <p className="text-[0.8125rem] text-wine">{error}</p> : null}
    </div>
  );
}
