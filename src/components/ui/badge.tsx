import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { StatusTone } from "@/lib/orders/status";

const tones: Record<StatusTone | "wax" | "olive", string> = {
  neutral: "bg-ink/[0.07] text-ink",
  info: "bg-sky-soft text-sky-ink",
  warning: "bg-wax-soft text-wax-ink",
  success: "bg-olive-soft text-olive",
  danger: "bg-wine-soft text-wine",
  wax: "bg-wax-soft text-wax-ink",
  olive: "bg-olive text-white",
};

export function Badge({ tone = "neutral", children, className }: { tone?: keyof typeof tones; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium leading-5", tones[tone], className)}>
      {children}
    </span>
  );
}

/** Product badges on cards and product pages. */
export function ProductBadge({ kind, label }: { kind: string; label: string }) {
  const style: Record<string, string> = {
    sale: "bg-wine text-white",
    new: "bg-plaster text-ink ring-1 ring-ink/15",
    bestseller: "bg-wax-soft text-wax-ink",
    limited: "bg-olive text-white",
    "sold-out": "bg-ink/80 text-white",
  };
  return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium leading-5", style[kind] ?? style.new)}>{label}</span>;
}
