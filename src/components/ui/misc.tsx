import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeftIcon, ChevronRightIcon, StarIcon } from "./icons";

export function Container({ children, className, wide }: { children: ReactNode; className?: string; wide?: boolean }) {
  return <div className={cn("mx-auto w-full px-4 sm:px-6 lg:px-10", wide ? "max-w-[1440px]" : "max-w-[1240px]", className)}>{children}</div>;
}

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-ink-soft">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
            {index > 0 ? <ChevronRightIcon size={14} className="text-ink-soft/60" /> : null}
            {item.href && index < items.length - 1 ? (
              <Link href={item.href} className="hover:text-ink hover:underline underline-offset-4">
                {item.label}
              </Link>
            ) : (
              <span aria-current={index === items.length - 1 ? "page" : undefined} className={index === items.length - 1 ? "text-ink" : undefined}>
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function EmptyState({ title, children, action, className }: { title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-dashed border-line-strong/70 px-6 py-14 text-center", className)}>
      <h2 className="font-display text-subtitle text-ink">{title}</h2>
      {children ? <div className="mx-auto mt-2 max-w-md text-ink-soft">{children}</div> : null}
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Pagination({ page, pageCount, hrefFor }: { page: number; pageCount: number; hrefFor: (page: number) => string }) {
  if (pageCount <= 1) return null;
  const pages: (number | "gap")[] = [];
  for (let p = 1; p <= pageCount; p += 1) {
    if (p === 1 || p === pageCount || Math.abs(p - page) <= 1) pages.push(p);
    else if (pages[pages.length - 1] !== "gap") pages.push("gap");
  }
  const itemClass = "inline-flex h-11 min-w-11 items-center justify-center rounded-full px-3 text-sm";
  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={cn(itemClass, "hover:bg-ink/5")} rel="prev">
          <ChevronLeftIcon size={18} />
          <span className="sr-only">Previous page</span>
        </Link>
      ) : null}
      {pages.map((p, i) =>
        p === "gap" ? (
          <span key={`gap-${i}`} className="px-1 text-ink-soft" aria-hidden>
            …
          </span>
        ) : (
          <Link
            key={p}
            href={hrefFor(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(itemClass, p === page ? "bg-ink text-white" : "hover:bg-ink/5")}
          >
            {p}
          </Link>
        ),
      )}
      {page < pageCount ? (
        <Link href={hrefFor(page + 1)} className={cn(itemClass, "hover:bg-ink/5")} rel="next">
          <ChevronRightIcon size={18} />
          <span className="sr-only">Next page</span>
        </Link>
      ) : null}
    </nav>
  );
}

export function Stars({ rating, size = 16, className }: { rating: number; size?: number; className?: string }) {
  const rounded = Math.round(rating);
  return (
    <span className={cn("inline-flex items-center text-wax", className)} role="img" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <StarIcon key={n} size={size} filled={n <= rounded} strokeWidth={1.3} />
      ))}
    </span>
  );
}

export function PageHeading({ title, description, children, className }: { title: string; description?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      <h1 className="font-display text-[2.25rem] leading-[1.1] text-ink sm:text-title md:text-display">{title}</h1>
      {description ? <div className="max-w-2xl text-[1.0625rem] text-ink-soft">{description}</div> : null}
      {children}
    </div>
  );
}
