import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadAccessibleOrder } from "@/lib/orders/access";
import { getAllSettings } from "@/lib/settings";
import { Container } from "@/components/ui/misc";
import { Notice } from "@/components/ui/form-message";
import { OrderView } from "@/components/orders/order-view";

export const metadata: Metadata = { title: "Your order", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

export default async function OrderPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ token?: string; placed?: string }> }) {
  const { number } = await params;
  const { token, placed } = await searchParams;
  const access = await loadAccessibleOrder({ number: decodeURIComponent(number) }, token);
  if (!access) notFound();
  const settings = await getAllSettings();
  const currency = { code: access.order.currency, decimals: settings.commerce.currencyDecimals, locale: settings.commerce.currencyLocale };

  return (
    <Container wide className="space-y-10 py-10 sm:py-14">
      <div className="space-y-3">
        <p className="text-sm text-ink-soft">
          Order {access.order.number}, placed on {access.order.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
        </p>
        <h1 className="font-display text-[2.25rem] leading-tight sm:text-title">{placed ? `Thank you, ${access.order.customerName.split(" ")[0]}` : "Your order"}</h1>
        {placed ? (
          <Notice tone="success" className="max-w-2xl">
            We&apos;ve received your order and sent a confirmation to {access.order.email}.
            {access.order.paymentMethodType !== "CASH_ON_DELIVERY" ? " Follow the payment steps below — we'll start preparing your order once payment is confirmed." : ""}
          </Notice>
        ) : null}
        {!access.viewer.isOwner && access.viewer.hasToken ? (
          <p className="text-sm text-ink-soft">
            Bookmark this page or keep the confirmation email to check your order later.{" "}
            <Link href="/register" className="underline underline-offset-4">
              Create an account
            </Link>{" "}
            to track future orders in one place.
          </p>
        ) : null}
      </div>
      <OrderView access={access} currency={currency} token={token ?? null} />
    </Container>
  );
}
