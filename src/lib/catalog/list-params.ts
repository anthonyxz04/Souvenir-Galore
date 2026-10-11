import { parseMoney } from "../money";
import { SORT_OPTIONS, type ProductListParams, type SortValue } from "./queries";

export type SearchParams = Record<string, string | string[] | undefined>;

const RESERVED = new Set(["q", "sort", "page", "min", "max", "availability", "sale", "personalizable"]);

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function list(value: string | string[] | undefined): string[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter((v) => /^[a-z0-9-]{1,80}$/.test(v))
    .slice(0, 20);
}

/** Read listing filters from the URL. Unknown values are ignored. */
export function parseListParams(searchParams: SearchParams, groupSlugs: string[], decimals: number): ProductListParams {
  const sortValue = first(searchParams.sort);
  const sort = SORT_OPTIONS.some((o) => o.value === sortValue) ? (sortValue as SortValue) : undefined;
  const page = Number(first(searchParams.page) ?? "1");
  const min = parseMoney(first(searchParams.min), decimals);
  const max = parseMoney(first(searchParams.max), decimals);
  const availability = first(searchParams.availability);
  const tags: Record<string, string[]> = {};
  for (const slug of groupSlugs) {
    if (RESERVED.has(slug)) continue;
    const values = list(searchParams[slug]);
    if (values.length) tags[slug] = values;
  }
  return {
    q: first(searchParams.q)?.slice(0, 100),
    sort,
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
    minPrice: min ?? undefined,
    maxPrice: max ?? undefined,
    availability: availability === "in_stock" || availability === "made_to_order" ? availability : undefined,
    onSale: first(searchParams.sale) === "1" || undefined,
    personalizable: first(searchParams.personalizable) === "1" || undefined,
    tags,
  };
}

/** Build a URL that keeps the current filters and changes some of them. */
export function listingHref(pathname: string, searchParams: SearchParams, changes: Record<string, string | null>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) params.append(key, v);
  }
  for (const [key, value] of Object.entries(changes)) {
    params.delete(key);
    if (value !== null && value !== "") params.set(key, value);
  }
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function activeFilterCount(params: ProductListParams): number {
  let count = 0;
  if (params.minPrice !== undefined || params.maxPrice !== undefined) count += 1;
  if (params.availability) count += 1;
  if (params.onSale) count += 1;
  if (params.personalizable) count += 1;
  for (const values of Object.values(params.tags ?? {})) count += values.length;
  return count;
}
