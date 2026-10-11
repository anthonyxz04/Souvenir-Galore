import { cn } from "@/lib/utils";
import { ArrowDownIcon, ArrowUpIcon } from "@/components/ui/icons";

/** KPI tile: label, value, optional change vs the previous period. */
export function StatTile({ label, value, hint, current, previous, upIsGood = true }: { label: string; value: string; hint?: string; current?: number; previous?: number; upIsGood?: boolean }) {
  let delta: { text: string; good: boolean; up: boolean } | null = null;
  if (current !== undefined && previous !== undefined && previous > 0) {
    const change = ((current - previous) / previous) * 100;
    const up = change >= 0;
    delta = { text: `${up ? "+" : "−"}${Math.abs(change).toFixed(0)}%`, up, good: up === upIsGood };
  }
  return (
    <div className="rounded-2xl bg-plaster p-5 ring-1 ring-line/70">
      <p className="text-sm text-ink-soft">{label}</p>
      <p className="mt-2 text-[1.75rem] font-semibold leading-none tracking-tight text-ink">{value}</p>
      <div className="mt-2 flex min-h-5 flex-wrap items-center gap-2 text-[0.8125rem]">
        {delta ? (
          <span className={cn("inline-flex items-center gap-0.5 font-medium", delta.good ? "text-olive" : "text-wine")}>
            {delta.up ? <ArrowUpIcon size={13} /> : <ArrowDownIcon size={13} />}
            {delta.text}
            <span className="sr-only">compared with the previous period</span>
          </span>
        ) : null}
        {hint ? <span className="text-ink-soft">{hint}</span> : null}
      </div>
    </div>
  );
}
