import type { Metadata } from "next";
import type { SearchParams } from "@/lib/catalog/list-params";
import { Container, PageHeading } from "@/components/ui/misc";
import { ProductListing } from "@/components/store/product-listing";
import { SearchIcon } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Search", robots: { index: false, follow: true } };

export default async function SearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const q = (Array.isArray(params.q) ? params.q[0] : params.q)?.trim() ?? "";
  return (
    <Container wide className="space-y-10 py-10 sm:py-14">
      <PageHeading title={q ? `Results for “${q}”` : "Search"}>
        <form action="/search" method="get" role="search" className="relative max-w-xl">
          <label htmlFor="search-page-q" className="sr-only">
            Search products
          </label>
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft" size={20} />
          <input
            id="search-page-q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Search candles, favors, names…"
            className="h-12 w-full rounded-full border border-line-strong/70 bg-plaster pl-12 pr-4 text-base focus:border-olive focus:outline-none"
          />
        </form>
      </PageHeading>
      <ProductListing
        pathname="/search"
        searchParams={params}
        scope={{ q }}
        emptyTitle={q ? `Nothing found for “${q}”` : "Start typing to search"}
        emptyBody="Try a different word, or ask us — many pieces can be made to order."
      />
    </Container>
  );
}
