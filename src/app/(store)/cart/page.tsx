import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCart } from "@/lib/cart/service";
import { checkDiscount, describeDiscount, discountAmount, discountErrorMessage, normalizeDiscountCode } from "@/lib/discounts/evaluate";
import { formatMoney } from "@/lib/money";
import { getAllSettings } from "@/lib/settings";
import { publicMediaBase } from "@/lib/storage";
import { removeCartItemAction } from "@/server/actions/cart";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/form-message";
import { Container, EmptyState, PageHeading } from "@/components/ui/misc";
import { ImagePlaceholder, ResponsiveImage } from "@/components/ui/responsive-image";
import { DiscountForm, QuantityForm } from "@/components/cart/cart-controls";

export const metadata: Metadata = { title: "Your cart", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CartPage() {
  const [cart, settings] = await Promise.all([getCart(), getAllSettings()]);
  const { commerce } = settings;
  const currency = { code: commerce.currencyCode, decimals: commerce.currencyDecimals, locale: commerce.currencyLocale };
  const fmt = (minor: number) => formatMoney(minor, currency);
  const base = publicMediaBase();

  if (cart.lines.length === 0) {
    return (
      <Container className="py-12 sm:py-16">
        <PageHeading title="Your cart" />
        <EmptyState title="Your cart is empty" className="mt-10" action={<ButtonLink href="/shop">Browse the shop</ButtonLink>}>
          Candles, keepsakes and gifts are waiting — many can be personalized with a name or date.
        </EmptyState>
      </Container>
    );
  }

  let discountLine: { label: string; amount: number; note?: string } | null = null;
  let discountError: string | null = null;
  if (cart.discountCode) {
    const discount = await prisma.discount.findUnique({ where: { code: normalizeDiscountCode(cart.discountCode) } });
    const check = checkDiscount(discount, { subtotal: cart.subtotal });
    if (check.ok) {
      const result = discountAmount(check.rule, cart.subtotal);
      discountLine = { label: describeDiscount(check.rule, fmt), amount: result.amount, note: result.freeDelivery ? "Free delivery applied at checkout" : undefined };
    } else {
      discountError = `Code ${cart.discountCode}: ${discountErrorMessage(check, fmt)}`;
    }
  }
  const estimated = cart.subtotal - (discountLine?.amount ?? 0);
  const belowMinimum = commerce.minOrderSubtotal > 0 && cart.subtotal < commerce.minOrderSubtotal;

  return (
    <Container wide className="py-10 sm:py-14">
      <PageHeading title="Your cart" />
      <div className="mt-10 grid gap-10 lg:grid-cols-12 lg:gap-14">
        <section aria-label="Items in your cart" className="lg:col-span-8">
          <ul className="divide-y divide-line border-y border-line">
            {cart.lines.map((line) => (
              <li key={line.id} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-4 py-6 sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:gap-6">
                <Link href={`/products/${line.productSlug}`} className="block aspect-[4/5] overflow-hidden rounded-[var(--radius-image)] bg-plaster" tabIndex={-1} aria-hidden>
                  {line.image ? <ResponsiveImage media={line.image} base={base} alt="" sizes="112px" className="h-full w-full object-cover" /> : <ImagePlaceholder />}
                </Link>
                <div className="min-w-0 space-y-1.5">
                  <h2 className="text-base font-medium leading-snug">
                    <Link href={`/products/${line.productSlug}`} className="hover:underline hover:underline-offset-4">
                      {line.productName}
                    </Link>
                  </h2>
                  {line.variantTitle ? <p className="text-sm text-ink-soft">{line.variantTitle}</p> : null}
                  {line.personalization.length ? (
                    <dl className="space-y-0.5 text-sm text-ink-soft">
                      {line.personalization.map((p) => (
                        <div key={p.label} className="flex gap-1.5">
                          <dt>{p.label}:</dt>
                          <dd className="whitespace-pre-line text-ink">{p.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  <p className="text-sm text-ink-soft">
                    {fmt(line.unitPrice + line.personalizationPrice)} each
                    {line.compareAt ? <s className="ml-2">{fmt(line.compareAt + line.personalizationPrice)}</s> : null}
                  </p>
                  {line.madeToOrder ? <p className="text-sm text-wax-ink">Made to order{line.prepTimeMaxDays ? ` — ready in up to ${line.prepTimeMaxDays} days` : ""}</p> : null}
                  {line.issue ? <p className="text-sm text-wine">{line.issue}</p> : null}
                  <div className="flex items-center gap-4 pt-2">
                    <QuantityForm itemId={line.id} quantity={line.quantity} max={line.maxQuantity} label={line.productName} />
                    <form action={removeCartItemAction}>
                      <input type="hidden" name="itemId" value={line.id} />
                      <button type="submit" className="text-sm text-ink-soft underline underline-offset-4 hover:text-wine">
                        Remove<span className="sr-only"> {line.productName}</span>
                      </button>
                    </form>
                  </div>
                </div>
                <p className="col-start-2 text-base font-medium sm:col-start-3 sm:row-start-1 sm:text-right">{fmt(line.lineTotal)}</p>
              </li>
            ))}
          </ul>
          <Link href="/shop" className="mt-6 inline-block text-[0.9375rem] text-olive underline underline-offset-4">
            Continue shopping
          </Link>
        </section>

        <aside aria-label="Order summary" className="lg:col-span-4">
          <div className="space-y-5 rounded-2xl bg-plaster p-6 lg:sticky lg:top-28">
            <h2 className="font-display text-2xl">Summary</h2>
            <DiscountForm appliedCode={cart.discountCode} />
            {discountError ? <p className="text-sm text-wine">{discountError}</p> : null}
            <dl className="space-y-2.5 border-t border-line pt-4 text-[0.9375rem]">
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd>{fmt(cart.subtotal)}</dd>
              </div>
              {discountLine ? (
                <div className="flex justify-between text-olive">
                  <dt>{discountLine.label}</dt>
                  <dd>−{fmt(discountLine.amount)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between text-ink-soft">
                <dt>Delivery</dt>
                <dd>{discountLine?.note ?? "Calculated at checkout"}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-3 text-lg font-medium">
                <dt>Estimated total</dt>
                <dd>{fmt(estimated)}</dd>
              </div>
              {commerce.taxEnabled && commerce.taxIncluded ? <p className="text-sm text-ink-soft">Prices include {commerce.taxLabel}.</p> : null}
            </dl>
            {belowMinimum ? <Notice tone="warning">The minimum order is {fmt(commerce.minOrderSubtotal)}. Add {fmt(commerce.minOrderSubtotal - cart.subtotal)} more to check out.</Notice> : null}
            {cart.hasIssues ? <Notice tone="warning">Some items need your attention before checkout.</Notice> : null}
            {cart.hasIssues || belowMinimum ? (
              <span className="flex h-13 w-full cursor-not-allowed items-center justify-center rounded-full bg-ink/20 text-[0.9375rem] font-medium text-ink/60" aria-disabled>
                Check out
              </span>
            ) : (
              <ButtonLink href="/checkout" size="lg" className="w-full">
                Check out
              </ButtonLink>
            )}
          </div>
        </aside>
      </div>
    </Container>
  );
}
