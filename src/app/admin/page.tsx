import Link from "next/link";
import { getDashboardMetrics, PERIODS, type PeriodKey } from "@/lib/analytics";
import { requireStaffPage } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { formatMoney } from "@/lib/money";
import { getAllSettings } from "@/lib/settings";
import { prisma } from "@/lib/db";
import { canEnable } from "@/lib/payments/rules";
import { cn } from "@/lib/utils";
import { AdminPageHeader, Panel, Table, Td, Th, EmptyRow } from "@/components/admin/admin-ui";
import { ColumnChart } from "@/components/admin/charts";
import { StatTile } from "@/components/admin/stat-tile";
import { Notice } from "@/components/ui/form-message";
import { AddDemoCatalogButton } from "@/components/admin/demo-catalog";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { removeDemoCatalogAction } from "@/server/actions/admin/products";
import { DEMO_PRODUCT_COUNT } from "@/lib/demo-catalog";

export default async function AdminDashboardPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const user = await requireStaffPage("dashboard:view");
  const { period: periodParam } = await searchParams;
  const period: PeriodKey = periodParam && periodParam in PERIODS ? (periodParam as PeriodKey) : "30d";
  const settings = await getAllSettings();
  const currency = { code: settings.commerce.currencyCode, decimals: settings.commerce.currencyDecimals, locale: settings.commerce.currencyLocale };
  const fmt = (minor: number) => formatMoney(minor, currency);
  const canSeeAnalytics = hasPermission(user.role, "analytics:view");
  const canManageProducts = hasPermission(user.role, "products:manage");

  const [metrics, enabledMethods, activeZones, productCount, demoProducts] = await Promise.all([
    getDashboardMetrics(period, settings.commerce.lowStockThreshold),
    prisma.paymentMethod.findMany({ where: { isEnabled: true }, select: { type: true, name: true, instructions: true, config: true, provider: true } }),
    prisma.deliveryZone.count({ where: { isActive: true } }),
    prisma.product.count({ where: { status: "ACTIVE" } }),
    prisma.product.count({ where: { status: { not: "ARCHIVED" }, variants: { some: { sku: { startsWith: "DEMO-" } } } } }),
  ]);

  const setup = [
    { done: productCount > 0, label: "Publish your first products", href: "/admin/products" },
    { done: enabledMethods.some((m) => canEnable({ ...m, config: (m.config ?? {}) as Record<string, unknown> })), label: "Enable at least one payment method", href: "/admin/payments" },
    { done: activeZones > 0 || settings.pickup.enabled, label: "Turn on delivery zones or pickup", href: "/admin/delivery" },
    { done: Boolean(settings.contact.email || settings.contact.whatsapp), label: "Add your contact details", href: "/admin/settings" },
  ];
  const setupRemaining = setup.filter((s) => !s.done);

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title={`Hello, ${user.name.split(" ")[0]}`}
        description="Sales figures count only payments you've verified. Unpaid and cancelled orders are shown separately."
        actions={
          <nav aria-label="Period" className="flex rounded-full bg-plaster p-1 ring-1 ring-line">
            {(Object.keys(PERIODS) as PeriodKey[]).map((key) => (
              <Link
                key={key}
                href={`/admin?period=${key}`}
                aria-current={key === period ? "page" : undefined}
                className={cn("rounded-full px-3 py-1.5 text-sm", key === period ? "bg-ink text-white" : "text-ink-soft hover:text-ink")}
              >
                {PERIODS[key].label.replace("Last ", "")}
              </Link>
            ))}
          </nav>
        }
      />

      {demoProducts > 0 ? (
        <Notice tone="danger" title={`${demoProducts} sample ${demoProducts === 1 ? "product is" : "products are"} in your shop`}>
          <p>
            Sample products (SKU starting with DEMO-) use example prices and illustrations so you can try the shop. Remove them before you launch, or edit them into real products from{" "}
            <Link href="/admin/products?q=DEMO-" className="underline underline-offset-4">
              Products
            </Link>
            .
          </p>
          {canManageProducts ? (
            <div className="mt-3">
              <ConfirmButton
                action={removeDemoCatalogAction}
                fields={{}}
                label="Remove sample products"
                title="Remove all sample products?"
                description="Sample products are deleted with their images. Any that already appear in an order are archived instead, so order records stay complete."
                confirmLabel="Remove sample products"
              />
            </div>
          ) : null}
        </Notice>
      ) : null}

      {productCount === 0 && canManageProducts ? (
        <Notice tone="info" title="Your shop has no products yet">
          <p>
            <Link href="/admin/products/new" className="underline underline-offset-4">
              Add your first product
            </Link>
            , or add {DEMO_PRODUCT_COUNT} clearly labelled sample products to try the shop, cart and checkout. You can remove them with one click later.
          </p>
          <div className="mt-3">
            <AddDemoCatalogButton count={DEMO_PRODUCT_COUNT} />
          </div>
        </Notice>
      ) : null}

      {setupRemaining.length ? (
        <Notice tone="warning" title="Before you start selling">
          <ul className="mt-1 space-y-1">
            {setupRemaining.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="underline underline-offset-4">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </Notice>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Link href="/admin/orders?status=PENDING" className="rounded-2xl bg-plaster p-5 ring-1 ring-line/70 hover:ring-ink/30">
          <p className="text-sm text-ink-soft">Orders to confirm</p>
          <p className="mt-2 text-[1.75rem] font-semibold leading-none">{metrics.pendingOrders}</p>
        </Link>
        <Link href="/admin/orders?payment=UNDER_REVIEW" className={cn("rounded-2xl p-5 ring-1 hover:ring-ink/30", metrics.awaitingVerification ? "bg-wax-soft ring-wax/40" : "bg-plaster ring-line/70")}>
          <p className="text-sm text-ink-soft">Payments to verify</p>
          <p className="mt-2 text-[1.75rem] font-semibold leading-none">{metrics.awaitingVerification}</p>
        </Link>
        <Link href="/admin/custom-requests" className="rounded-2xl bg-plaster p-5 ring-1 ring-line/70 hover:ring-ink/30">
          <p className="text-sm text-ink-soft">Open custom requests</p>
          <p className="mt-2 text-[1.75rem] font-semibold leading-none">{metrics.openRequests}</p>
        </Link>
        <Link href="/admin/inventory?filter=low" className="rounded-2xl bg-plaster p-5 ring-1 ring-line/70 hover:ring-ink/30">
          <p className="text-sm text-ink-soft">Low or out of stock</p>
          <p className="mt-2 text-[1.75rem] font-semibold leading-none">{metrics.lowStock.length}</p>
        </Link>
      </div>

      {canSeeAnalytics ? (
        <>
          <section aria-label="Key figures" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Completed sales" value={fmt(metrics.revenue)} current={metrics.revenue} previous={metrics.revenuePrevious} hint={`${metrics.paidOrderCount} paid`} />
            <StatTile label="Gross order value" value={fmt(metrics.grossOrderValue)} current={metrics.grossOrderValue} previous={metrics.grossOrderValuePrevious} hint="Placed, not cancelled" />
            <StatTile label="Orders placed" value={String(metrics.orderCount)} current={metrics.orderCount} previous={metrics.orderCountPrevious} hint={metrics.cancelledCount ? `${metrics.cancelledCount} cancelled` : undefined} />
            <StatTile label="Average order value" value={fmt(metrics.averageOrderValue)} hint="Paid orders" />
            <StatTile label="Outstanding payments" value={fmt(metrics.outstandingValue)} hint={`${metrics.outstandingCount} unpaid orders, all time`} />
            <StatTile label="Refunds" value={fmt(metrics.refundsValue)} hint={`${metrics.refundsCount} in period`} upIsGood={false} />
            <StatTile label="New customers" value={String(metrics.newCustomers)} hint="Accounts created" />
          </section>

          <Panel title="Completed sales" description={`${metrics.period.monthly ? "Monthly" : "Daily"} verified payments, ${PERIODS[period].label.toLowerCase()}`}>
            <ColumnChart data={metrics.salesSeries} currency={currency} title="Completed sales over time" />
            <details className="mt-3 text-sm">
              <summary className="text-ink-soft hover:text-ink">Show as table</summary>
              <table className="mt-2 w-full text-left">
                <thead>
                  <tr>
                    <th className="py-1 font-medium text-ink-soft">{metrics.period.monthly ? "Month" : "Day"}</th>
                    <th className="py-1 text-right font-medium text-ink-soft">Completed sales</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.salesSeries.map((d) => (
                    <tr key={d.key} className="border-t border-line/60">
                      <td className="py-1">{d.label}</td>
                      <td className="py-1 text-right tabular-nums">{fmt(d.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </Panel>

          <div className="grid gap-6 xl:grid-cols-2">
            <Panel title="Bestselling products" description="By quantity ordered, excluding cancelled orders" padded={false}>
              <table className="w-full text-left text-[0.9375rem]">
                <thead>
                  <tr>
                    <th className="px-5 py-2.5 text-xs font-semibold text-ink-soft">Product</th>
                    <th className="px-5 py-2.5 text-right text-xs font-semibold text-ink-soft">Sold</th>
                    <th className="px-5 py-2.5 text-right text-xs font-semibold text-ink-soft">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.bestsellers.length ? (
                    metrics.bestsellers.map((item) => (
                      <tr key={`${item.productId}-${item.name}`} className="border-t border-line/60">
                        <td className="px-5 py-2.5">{item.productId ? <Link href={`/admin/products/${item.productId}`} className="hover:underline">{item.name}</Link> : item.name}</td>
                        <td className="px-5 py-2.5 text-right tabular-nums">{item.quantity}</td>
                        <td className="px-5 py-2.5 text-right tabular-nums">{fmt(item.total)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-5 py-8 text-center text-ink-soft">
                        No orders in this period yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Panel>

            <Panel title="Completed sales by category" description="A product in two categories counts in both">
              {metrics.salesByCategory.length ? (
                <ul className="space-y-3">
                  {(() => {
                    const max = Math.max(...metrics.salesByCategory.map((c) => c.total), 1);
                    return metrics.salesByCategory.map((category) => (
                      <li key={category.name} className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3 text-sm sm:grid-cols-[minmax(0,12rem)_1fr]">
                        <span className="truncate">{category.name}</span>
                        <span className="flex items-center gap-2">
                          <span className="h-4 rounded-r-[4px] bg-olive" style={{ width: `${Math.max(2, (category.total / max) * 100)}%`, maxWidth: "calc(100% - 6rem)" }} aria-hidden />
                          <span className="shrink-0 tabular-nums">{fmt(category.total)}</span>
                        </span>
                      </li>
                    ));
                  })()}
                </ul>
              ) : (
                <p className="py-6 text-center text-ink-soft">No verified sales in this period yet.</p>
              )}
            </Panel>
          </div>
        </>
      ) : null}

      <Table>
        <thead>
          <tr>
            <Th>Low or out of stock</Th>
            <Th>SKU</Th>
            <Th className="text-right">In stock</Th>
          </tr>
        </thead>
        <tbody>
          {metrics.lowStock.length ? (
            metrics.lowStock.map((variant) => (
              <tr key={variant.id}>
                <Td>
                  <Link href={`/admin/products/${variant.product.id}`} className="hover:underline">
                    {variant.product.name}
                    {variant.title !== "Default" ? <span className="text-ink-soft"> — {variant.title}</span> : null}
                  </Link>
                </Td>
                <Td className="text-ink-soft">{variant.sku ?? "—"}</Td>
                <Td className={cn("text-right tabular-nums", variant.stock <= 0 ? "text-wine" : "text-wax-ink")}>{variant.stock}</Td>
              </tr>
            ))
          ) : (
            <EmptyRow colSpan={3}>Nothing is running low.</EmptyRow>
          )}
        </tbody>
      </Table>
    </div>
  );
}
