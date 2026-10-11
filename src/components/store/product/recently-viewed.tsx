"use client";

import { useEffect, useState } from "react";
import type { ProductCardData } from "@/lib/catalog/queries";
import type { CurrencyConfig } from "@/lib/money";
import { ProductGrid } from "../product-card";

const KEY = "sg-recently-viewed";
const MAX = 12;

function read(): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((v) => typeof v === "string").slice(0, MAX) : [];
  } catch {
    return [];
  }
}

/** Remembers viewed products in this browser only (a convenience, not account data). */
export function TrackRecentlyViewed({ productId }: { productId: string }) {
  useEffect(() => {
    try {
      const next = [productId, ...read().filter((id) => id !== productId)].slice(0, MAX);
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  }, [productId]);
  return null;
}

export function RecentlyViewed({ excludeId, base, currency }: { excludeId?: string; base: string; currency: CurrencyConfig }) {
  const [products, setProducts] = useState<ProductCardData[]>([]);

  useEffect(() => {
    const ids = read().filter((id) => id !== excludeId).slice(0, 4);
    if (ids.length === 0) return;
    const controller = new AbortController();
    fetch(`/api/products/cards?ids=${ids.map(encodeURIComponent).join(",")}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : { products: [] }))
      .then((data: { products: ProductCardData[] }) => setProducts(data.products ?? []))
      .catch(() => undefined);
    return () => controller.abort();
  }, [excludeId]);

  if (products.length === 0) return null;
  return (
    <section aria-labelledby="recent-heading" className="mt-20">
      <h2 id="recent-heading" className="mb-8 font-display text-[2rem] leading-tight sm:text-title">
        Recently viewed
      </h2>
      <ProductGrid products={products} base={base} currency={currency} />
    </section>
  );
}
