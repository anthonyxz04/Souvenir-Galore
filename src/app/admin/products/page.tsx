import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guards";
import { categoryTree } from "@/lib/catalog/admin-choices";
import { formatMoney } from "@/lib/money";
import { getCurrency } from "@/lib/settings";
import { publicMediaBase } from "@/lib/storage";
import { mediaUrl } from "@/lib/storage/urls";
import { AdminPageHeader, EmptyRow, FilterBar, FilterSearch, FilterSelect, Table, Td, Th } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Pagination } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Products" };
const PER_PAGE = 40;

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; category?: string; stock?: string; page?: string }> }) {
  await requireStaffPage("products:manage", "/admin/products");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const where: Prisma.ProductWhereInput = {};
  if (params.status === "DRAFT" || params.status === "ACTIVE" || params.status === "ARCHIVED") where.status = params.status;
  else where.status = { not: "ARCHIVED" };
  if (params.category) where.categories = { some: { categoryId: params.category } };
  if (params.stock === "out") where.inStock = false;
  const q = params.q?.trim().slice(0, 100);
  if (q) where.OR = [{ name: { contains: q, mode: "insensitive" } }, { variants: { some: { sku: { contains: q, mode: "insensitive" } } } }];

  const [total, products, categories, currency] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        name: true,
        status: true,
        pricingType: true,
        priceMin: true,
        priceMax: true,
        inStock: true,
        trackInventory: true,
        madeToOrder: true,
        salesCount: true,
        images: { orderBy: { position: "asc" }, take: 1, select: { asset: { select: { key: true, renditions: true } } } },
        variants: { where: { isActive: true }, select: { stock: true } },
        categories: { select: { category: { select: { name: true } } }, take: 2 },
      },
    }),
    categoryTree(),
    getCurrency(),
  ]);
  const base = publicMediaBase();
  const query = new URLSearchParams(Object.entries(params).filter(([k, v]) => v && k !== "page") as [string, string][]);

  return (
    <div>
      <AdminPageHeader title="Products" description="Archived products are hidden from this list unless you filter for them." actions={<ButtonLink href="/admin/products/new">Add product</ButtonLink>} />
      <FilterBar>
        <FilterSearch value={q} placeholder="Name or SKU" />
        <FilterSelect name="status" label="Status" value={params.status} options={[{ value: "", label: "Draft & active" }, { value: "ACTIVE", label: "Active" }, { value: "DRAFT", label: "Draft" }, { value: "ARCHIVED", label: "Archived" }]} />
        <FilterSelect name="category" label="Category" value={params.category} options={[{ value: "", label: "Any" }, ...categories.map((c) => ({ value: c.id, label: `${"— ".repeat(c.depth)}${c.name}` }))]} />
        <FilterSelect name="stock" label="Stock" value={params.stock} options={[{ value: "", label: "Any" }, { value: "out", label: "Sold out" }]} />
      </FilterBar>
      <Table>
        <thead>
          <tr>
            <Th>Product</Th>
            <Th>Status</Th>
            <Th>Price</Th>
            <Th>Stock</Th>
            <Th className="text-right">Sold</Th>
          </tr>
        </thead>
        <tbody>
          {products.length ? (
            products.map((product) => {
              const stock = product.variants.reduce((sum, v) => sum + v.stock, 0);
              const image = product.images[0]?.asset;
              return (
                <tr key={product.id} className="hover:bg-white/50">
                  <Td>
                    <Link href={`/admin/products/${product.id}`} className="flex items-center gap-3">
                      <span className="h-12 w-10 shrink-0 overflow-hidden rounded-md bg-limestone-deep">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {image ? <img src={mediaUrl(base, image, 320)} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}
                      </span>
                      <span>
                        <span className="block font-medium hover:underline">{product.name}</span>
                        <span className="text-xs text-ink-soft">{product.categories.map((c) => c.category.name).join(", ") || "No category"}</span>
                      </span>
                    </Link>
                  </Td>
                  <Td>
                    <Badge tone={product.status === "ACTIVE" ? "success" : product.status === "DRAFT" ? "warning" : "neutral"}>{product.status === "ACTIVE" ? "Active" : product.status === "DRAFT" ? "Draft" : "Archived"}</Badge>
                  </Td>
                  <Td className="tabular-nums">
                    {product.pricingType === "QUOTE" ? "On request" : product.priceMin === product.priceMax ? formatMoney(product.priceMin, currency) : `${formatMoney(product.priceMin, currency)} – ${formatMoney(product.priceMax, currency)}`}
                  </Td>
                  <Td>
                    {!product.trackInventory ? (
                      <span className="text-ink-soft">{product.madeToOrder ? "Made to order" : "Not tracked"}</span>
                    ) : (
                      <span className={product.inStock ? undefined : "text-wine"}>
                        {stock} {product.variants.length > 1 ? `in ${product.variants.length} variants` : ""}
                      </span>
                    )}
                  </Td>
                  <Td className="text-right tabular-nums">{product.salesCount}</Td>
                </tr>
              );
            })
          ) : (
            <EmptyRow colSpan={5}>
              No products found. <Link href="/admin/products/new" className="underline">Add your first product</Link>.
            </EmptyRow>
          )}
        </tbody>
      </Table>
      <div className="mt-6">
        <Pagination page={page} pageCount={Math.max(1, Math.ceil(total / PER_PAGE))} hrefFor={(p) => `/admin/products?${new URLSearchParams([...query.entries(), ...(p > 1 ? [["page", String(p)]] : [])]).toString()}`} />
      </div>
    </div>
  );
}
