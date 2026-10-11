import Link from "next/link";
import { getFilterGroups, listProducts, SORT_OPTIONS, type ProductListParams } from "@/lib/catalog/queries";
import { activeFilterCount, listingHref, parseListParams, type SearchParams } from "@/lib/catalog/list-params";
import { getCurrency } from "@/lib/settings";
import { publicMediaBase } from "@/lib/storage";
import { toMajorString } from "@/lib/money";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Pagination } from "@/components/ui/misc";
import { ProductGrid } from "./product-card";
import { FiltersDialog, SortSelect } from "./listing-controls";

type FilterGroup = Awaited<ReturnType<typeof getFilterGroups>>[number];

function FilterForm({
  pathname,
  params,
  groups,
  decimals,
  searchParams,
  hidePersonalizable,
  idPrefix,
}: {
  pathname: string;
  params: ProductListParams;
  groups: FilterGroup[];
  decimals: number;
  searchParams: SearchParams;
  hidePersonalizable?: boolean;
  idPrefix: string;
}) {
  const fieldset = "space-y-2.5 border-t border-line pt-5";
  const legend = "mb-1 text-sm font-semibold text-ink";
  const option = "flex min-h-9 items-center gap-3 text-[0.9375rem] text-ink";
  return (
    <form action={pathname} method="get" className="space-y-5">
      {params.q ? <input type="hidden" name="q" value={params.q} /> : null}
      {typeof searchParams.sort === "string" ? <input type="hidden" name="sort" value={searchParams.sort} /> : null}

      <fieldset className={fieldset}>
        <legend className={legend}>Price</legend>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor={`${idPrefix}-min`}>
            Minimum price
          </label>
          <input
            id={`${idPrefix}-min`}
            name="min"
            inputMode="decimal"
            placeholder="Min"
            defaultValue={params.minPrice !== undefined ? toMajorString(params.minPrice, decimals) : ""}
            className="h-10 w-full rounded-lg border border-line-strong/70 bg-plaster px-3 text-sm focus:border-olive focus:outline-none"
          />
          <span className="text-ink-soft" aria-hidden>
            –
          </span>
          <label className="sr-only" htmlFor={`${idPrefix}-max`}>
            Maximum price
          </label>
          <input
            id={`${idPrefix}-max`}
            name="max"
            inputMode="decimal"
            placeholder="Max"
            defaultValue={params.maxPrice !== undefined ? toMajorString(params.maxPrice, decimals) : ""}
            className="h-10 w-full rounded-lg border border-line-strong/70 bg-plaster px-3 text-sm focus:border-olive focus:outline-none"
          />
        </div>
      </fieldset>

      <fieldset className={fieldset}>
        <legend className={legend}>Availability</legend>
        <label className={option}>
          <input type="radio" name="availability" value="" defaultChecked={!params.availability} className="h-4 w-4 accent-olive" /> Everything
        </label>
        <label className={option}>
          <input type="radio" name="availability" value="in_stock" defaultChecked={params.availability === "in_stock"} className="h-4 w-4 accent-olive" /> Ready to ship
        </label>
        <label className={option}>
          <input type="radio" name="availability" value="made_to_order" defaultChecked={params.availability === "made_to_order"} className="h-4 w-4 accent-olive" /> Made to order
        </label>
      </fieldset>

      <fieldset className={fieldset}>
        <legend className={legend}>Offers</legend>
        <label className={option}>
          <input type="checkbox" name="sale" value="1" defaultChecked={params.onSale} className="h-4 w-4 accent-olive" /> On sale
        </label>
        {!hidePersonalizable ? (
          <label className={option}>
            <input type="checkbox" name="personalizable" value="1" defaultChecked={params.personalizable} className="h-4 w-4 accent-olive" /> Can be personalized
          </label>
        ) : null}
      </fieldset>

      {groups.map((group) => (
        <fieldset key={group.id} className={fieldset}>
          <legend className={legend}>{group.name}</legend>
          {group.tags.map((tag) => (
            <label key={tag.id} className={option}>
              <input
                type="checkbox"
                name={group.slug}
                value={tag.slug}
                defaultChecked={params.tags?.[group.slug]?.includes(tag.slug)}
                className="h-4 w-4 accent-olive"
              />
              <span className="flex-1">{tag.name}</span>
              <span className="text-xs text-ink-soft">{tag._count.products}</span>
            </label>
          ))}
        </fieldset>
      ))}

      <div className="sticky bottom-0 flex gap-2 bg-inherit pt-2">
        <button type="submit" className="h-11 flex-1 rounded-full bg-olive px-5 text-[0.9375rem] font-medium text-white hover:bg-olive-deep">
          Apply filters
        </button>
        <Link href={listingHref(pathname, params.q ? { q: params.q } : {}, {})} className="inline-flex h-11 items-center rounded-full px-4 text-[0.9375rem] text-ink-soft hover:bg-ink/5">
          Clear
        </Link>
      </div>
    </form>
  );
}

/**
 * Shared listing used by the shop, category, collection and search pages.
 * Filters are a plain GET form, so they work even before JavaScript loads.
 */
export async function ProductListing({
  pathname,
  searchParams,
  scope = {},
  emptyTitle = "No products here yet",
  emptyBody,
}: {
  pathname: string;
  searchParams: SearchParams;
  scope?: Pick<ProductListParams, "categoryId" | "collectionId" | "q">;
  emptyTitle?: string;
  emptyBody?: string;
}) {
  const [groups, currency] = await Promise.all([getFilterGroups(), getCurrency()]);
  const params = { ...parseListParams(searchParams, groups.map((g) => g.slug), currency.decimals), ...scope };
  const result = await listProducts(params);
  const base = publicMediaBase();
  const filterCount = activeFilterCount(params);
  const filterProps = { pathname, params, groups, decimals: currency.decimals, searchParams };

  return (
    <div className="grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12">
      <aside className="hidden lg:block" aria-label="Filters">
        <FilterForm {...filterProps} idPrefix="desktop" />
      </aside>
      <div className="min-w-0 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-soft" aria-live="polite">
            {result.total === 1 ? "1 product" : `${result.total} products`}
          </p>
          <div className="flex items-center gap-2">
            <FiltersDialog count={filterCount}>
              <FilterForm {...filterProps} idPrefix="mobile" />
            </FiltersDialog>
            <SortSelect
              options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              value={params.sort ?? "featured"}
              pathname={pathname}
              query={listingHref("", searchParams, {}).replace(/^\?/, "")}
            />
          </div>
        </div>

        {result.items.length ? (
          <>
            <ProductGrid products={result.items} base={base} currency={currency} columns={3} priorityCount={3} />
            <Pagination page={result.page} pageCount={result.pageCount} hrefFor={(page) => listingHref(pathname, searchParams, { page: page === 1 ? null : String(page) })} />
          </>
        ) : (
          <EmptyState
            title={filterCount ? "Nothing matches these filters" : emptyTitle}
            action={filterCount ? <ButtonLink href={pathname} variant="secondary">Clear filters</ButtonLink> : <ButtonLink href="/shop">Browse everything</ButtonLink>}
          >
            {filterCount ? "Try removing a filter or widening the price range." : emptyBody}
          </EmptyState>
        )}
      </div>
    </div>
  );
}
