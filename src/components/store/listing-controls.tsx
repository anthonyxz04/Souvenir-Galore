"use client";

import { useRouter } from "next/navigation";
import { useId, type ReactNode } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

export function SortSelect({ options, value, pathname, query }: { options: { value: string; label: string }[]; value: string; pathname: string; query: string }) {
  const router = useRouter();
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-sm text-ink-soft">
        Sort
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => {
          const params = new URLSearchParams(query);
          params.delete("page");
          if (event.target.value === "featured") params.delete("sort");
          else params.set("sort", event.target.value);
          const next = params.toString();
          router.push(next ? `${pathname}?${next}` : pathname, { scroll: false });
        }}
        className="h-10 rounded-full border border-line-strong/70 bg-plaster pl-4 pr-8 text-sm focus:border-olive focus:outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function FiltersDialog({ count, children }: { count: number; children: ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger className="inline-flex h-10 items-center gap-2 rounded-full border border-line-strong/70 bg-plaster px-4 text-sm lg:hidden">
        Filters
        {count ? <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-olive px-1.5 text-xs text-white">{count}</span> : null}
      </DialogTrigger>
      <DialogContent title="Filters" side="bottom" className="bg-plaster">
        {children}
      </DialogContent>
    </Dialog>
  );
}
