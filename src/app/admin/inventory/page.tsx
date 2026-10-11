import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guards";
import { variantAvailability } from "@/lib/catalog/pricing";
import { getSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { AdminPageHeader, EmptyRow, FilterBar, FilterSearch, FilterSelect, Table, Td, Th } from "@/components/admin/admin-ui";
import { StockAdjustForm } from "@/components/admin/stock-adjust-form";

export const metadata: Metadata = { title: "Inventory" };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string }> }) {
  await requireStaffPage("products:manage", "/admin/inventory");
  const { q, filter } = await searchParams;
  const commerce = await getSettings("commerce");
  const search = q?.trim().slice(0, 100);
  const variants = await prisma.productVariant.findMany({
    where: {
      isActive: true,
      product: { status: { not: "ARCHIVED" }, trackInventory: true, ...(search ? { name: { contains: search, mode: "insensitive" } } : {}) },
    },
    orderBy: [{ stock: "asc" }, { product: { name: "asc" } }],
    take: 500,
    select: {
      id: true,
      title: true,
      sku: true,
      stock: true,
      product: { select: { id: true, name: true, status: true, trackInventory: true, allowBackorder: true, madeToOrder: true, lowStockThreshold: true } },
    },
  });
  const rows = variants
    .map((variant) => ({ variant, availability: variantAvailability(variant, variant.product, commerce.lowStockThreshold) }))
    .filter(({ availability }) => (filter === "low" ? availability.status === "low_stock" || availability.status === "out_of_stock" || availability.status === "backorder" : true));

  return (
    <div>
      <AdminPageHeader
        title="Inventory"
        description={`Products with stock tracking turned on. Low stock means ${commerce.lowStockThreshold} or fewer unless a product sets its own alert level. Every change is logged.`}
      />
      <FilterBar>
        <FilterSearch value={search} placeholder="Product name" />
        <FilterSelect name="filter" label="Show" value={filter} options={[{ value: "", label: "All tracked" }, { value: "low", label: "Low or out of stock" }]} />
      </FilterBar>
      <Table>
        <thead>
          <tr>
            <Th>Product</Th>
            <Th>SKU</Th>
            <Th className="text-right">In stock</Th>
            <Th>Change stock</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map(({ variant, availability }) => (
              <tr key={variant.id}>
                <Td>
                  <Link href={`/admin/products/${variant.product.id}`} className="hover:underline">
                    {variant.product.name}
                  </Link>
                  {variant.title !== "Default" ? <p className="text-xs text-ink-soft">{variant.title}</p> : null}
                  {variant.product.status === "DRAFT" ? <p className="text-xs text-wax-ink">Draft</p> : null}
                </Td>
                <Td className="text-ink-soft">{variant.sku ?? "—"}</Td>
                <Td className={cn("text-right font-medium tabular-nums", availability.status === "out_of_stock" ? "text-wine" : availability.status === "low_stock" ? "text-wax-ink" : undefined)}>{variant.stock}</Td>
                <Td>
                  <StockAdjustForm variantId={variant.id} label={`${variant.product.name} ${variant.title}`} />
                </Td>
              </tr>
            ))
          ) : (
            <EmptyRow colSpan={4}>No products to show.</EmptyRow>
          )}
        </tbody>
      </Table>
    </div>
  );
}
