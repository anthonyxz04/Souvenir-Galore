import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeftIcon } from "@/components/ui/icons";

export function AdminPageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6 space-y-2 sm:mb-8">
      {back ? (
        <Link href={back.href} className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
          <ChevronLeftIcon size={16} /> {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h1 className="font-display text-[1.875rem] leading-tight text-ink sm:text-[2.125rem]">{title}</h1>
          {description ? <div className="max-w-3xl text-[0.9375rem] text-ink-soft">{description}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export function Panel({ title, description, actions, children, className, padded = true }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={cn("rounded-2xl bg-plaster ring-1 ring-line/70", className)}>
      {title || actions ? (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line/70 px-5 py-4">
          <div className="space-y-0.5">
            {title ? <h2 className="text-base font-semibold text-ink">{title}</h2> : null}
            {description ? <p className="text-sm text-ink-soft">{description}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={padded ? "p-5" : undefined}>{children}</div>
    </section>
  );
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-2xl bg-plaster ring-1 ring-line/70", className)}>
      <table className="w-full min-w-[640px] border-collapse text-left text-[0.9375rem]">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cn("border-b border-line px-4 py-3 text-xs font-semibold text-ink-soft", className)}>{children}</th>;
}

export function Td({ children, className, colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={cn("border-b border-line/60 px-4 py-3 align-middle", className)}>
      {children}
    </td>
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center text-ink-soft">
        {children}
      </td>
    </tr>
  );
}

export function FilterBar({ children, action }: { children: ReactNode; action?: string }) {
  return (
    <form method="get" action={action} className="mb-5 flex flex-wrap items-end gap-3">
      {children}
      <button type="submit" className="h-10 rounded-full bg-ink px-4 text-sm font-medium text-white hover:bg-ink/85">
        Apply
      </button>
    </form>
  );
}

export function FilterSelect({ name, label, value, options }: { name: string; label: string; value?: string; options: { value: string; label: string }[] }) {
  return (
    <label className="space-y-1 text-sm">
      <span className="block text-ink-soft">{label}</span>
      <select name={name} defaultValue={value ?? ""} className="h-10 rounded-full border border-line-strong/70 bg-plaster pl-4 pr-8 text-sm focus:border-olive focus:outline-none">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FilterSearch({ name = "q", label = "Search", value, placeholder }: { name?: string; label?: string; value?: string; placeholder?: string }) {
  return (
    <label className="min-w-56 flex-1 space-y-1 text-sm sm:flex-none">
      <span className="block text-ink-soft">{label}</span>
      <input name={name} type="search" defaultValue={value} placeholder={placeholder} className="h-10 w-full rounded-full border border-line-strong/70 bg-plaster px-4 text-sm focus:border-olive focus:outline-none sm:w-72" />
    </label>
  );
}

export function KeyValue({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 text-[0.9375rem] sm:grid-cols-[max-content_1fr]">
      {items.map((item) => (
        <div key={item.label} className="contents">
          <dt className="text-ink-soft">{item.label}</dt>
          <dd className="min-w-0 break-words">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function formatDateTime(date: Date | null | undefined) {
  if (!date) return "—";
  return date.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function formatDate(date: Date | null | undefined) {
  if (!date) return "—";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
