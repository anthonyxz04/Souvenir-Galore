import Link from "next/link";
import { notFound } from "next/navigation";
import { loadAccessibleOrder } from "@/lib/orders/access";
import { getAllSettings } from "@/lib/settings";
import { OrderView } from "@/components/orders/order-view";

export default async function AccountOrderPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const access = await loadAccessibleOrder({ number: decodeURIComponent(number) });
  if (!access || !access.viewer.isOwner) notFound();
  const settings = await getAllSettings();
  const currency = { code: access.order.currency, decimals: settings.commerce.currencyDecimals, locale: settings.commerce.currencyLocale };
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Link href="/account/orders" className="text-sm text-ink-soft underline underline-offset-4 hover:text-ink">
          All orders
        </Link>
        <h1 className="font-display text-[2.25rem] leading-tight sm:text-title">Order {access.order.number}</h1>
        <p className="text-sm text-ink-soft">Placed on {access.order.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
      </div>
      <OrderView access={access} currency={currency} token={null} />
    </div>
  );
}
