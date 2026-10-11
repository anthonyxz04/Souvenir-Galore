"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { SearchIcon } from "@/components/ui/icons";

type Suggestion = {
  products: { slug: string; name: string; price: string | null; image: string | null }[];
  categories: { name: string; slug: string }[];
};

/** Header search with live suggestions. Works as a plain GET form without JavaScript. */
export function SearchDialog() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Suggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const listId = useId();
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      return;
    }
    const timer = window.setTimeout(async () => {
      controller.current?.abort();
      controller.current = new AbortController();
      setLoading(true);
      try {
        const response = await fetch(`/api/search/suggest?q=${encodeURIComponent(q)}`, { signal: controller.current.signal });
        if (response.ok) setResults((await response.json()) as Suggestion);
      } catch {
        /* aborted or offline — keep previous results */
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [query]);

  const hasResults = results && (results.products.length > 0 || results.categories.length > 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-ink/5" aria-label="Search">
        <SearchIcon size={21} />
      </DialogTrigger>
      <DialogContent title="Search the shop" className="sm:top-24 sm:translate-y-0">
        <form
          action="/search"
          method="get"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            if (!query.trim()) return;
            setOpen(false);
            router.push(`/search?q=${encodeURIComponent(query.trim())}`);
          }}
        >
          <label htmlFor="site-search" className="sr-only">
            Search products
          </label>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft" size={20} />
            <input
              id="site-search"
              name="q"
              type="search"
              autoFocus
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Candles, wedding favors, names…"
              aria-controls={listId}
              className="h-13 w-full rounded-full border border-line-strong/70 bg-white pl-12 pr-4 text-base focus:border-olive focus:outline-none"
            />
          </div>
        </form>

        <div id={listId} aria-live="polite" className="mt-4 min-h-12">
          {loading && !results ? <p className="px-1 text-sm text-ink-soft">Searching…</p> : null}
          {results && !hasResults ? <p className="px-1 text-sm text-ink-soft">No matches yet. Press Enter to search everything.</p> : null}
          {hasResults ? (
            <div className="space-y-4">
              {results.categories.length ? (
                <ul className="flex flex-wrap gap-2">
                  {results.categories.map((category) => (
                    <li key={category.slug}>
                      <Link href={`/category/${category.slug}`} onClick={() => setOpen(false)} className="inline-flex rounded-full bg-limestone px-3 py-1.5 text-sm hover:bg-limestone-deep">
                        {category.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
              <ul className="divide-y divide-line">
                {results.products.map((product) => (
                  <li key={product.slug}>
                    <Link href={`/products/${product.slug}`} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl py-2.5 hover:bg-limestone/60">
                      <span className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-limestone-deep">
                        {product.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={product.image} alt="" className="h-full w-full object-cover" loading="lazy" />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.9375rem]">{product.name}</span>
                        {product.price ? <span className="block text-sm text-ink-soft">{product.price}</span> : null}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href={`/search?q=${encodeURIComponent(query.trim())}`} onClick={() => setOpen(false)} className="inline-block text-sm text-olive underline underline-offset-4">
                See all results for “{query.trim()}”
              </Link>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
