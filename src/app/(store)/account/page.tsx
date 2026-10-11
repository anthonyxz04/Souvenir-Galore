import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { getCartCount } from "@/lib/cart/service";
import { formatMoney } from "@/lib/money";
import { orderStatusLabel, ORDER_STATUS_TONE } from "@/lib/orders/status";
import { getCurrency } from "@/lib/settings";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/form-message";
import { ResendVerification } from "@/components/account/resend-verification";

export default async function AccountOverviewPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const user = await requireUser("/account");
  const { welcome } = await searchParams;
  const [orders, cartCount, wishlistCount, currency] = await Promise.all([
    prisma.order.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 3 }),
    getCartCount(),
    prisma.wishlistItem.count({ where: { userId: user.id } }),
    getCurrency(),
  ]);

  return (
    <div className="space-y-10">
      <h1 className="font-display text-[2.25rem] leading-tight sm:text-title">{welcome ? `Welcome, ${user.name.split(" ")[0]}` : `Hello, ${user.name.split(" ")[0]}`}</h1>

      {!user.emailVerifiedAt ? (
        <Notice tone="warning" title="Please confirm your email">
          <p>We sent a link to {user.email}. Confirming lets you write reviews and keeps your account secure.</p>
          <ResendVerification />
        </Notice>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/cart" className="rounded-2xl bg-plaster p-5 hover:bg-white">
          <p className="text-sm text-ink-soft">Saved cart</p>
          <p className="mt-1 font-display text-2xl">{cartCount === 1 ? "1 item" : `${cartCount} items`}</p>
        </Link>
        <Link href="/account/wishlist" className="rounded-2xl bg-plaster p-5 hover:bg-white">
          <p className="text-sm text-ink-soft">Wishlist</p>
          <p className="mt-1 font-display text-2xl">{wishlistCount === 1 ? "1 piece" : `${wishlistCount} pieces`}</p>
        </Link>
        <Link href="/account/addresses" className="rounded-2xl bg-plaster p-5 hover:bg-white">
          <p className="text-sm text-ink-soft">Addresses</p>
          <p className="mt-1 font-display text-2xl">Manage</p>
        </Link>
      </div>

      <section aria-labelledby="recent-orders" className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <h2 id="recent-orders" className="font-display text-2xl">
            Recent orders
          </h2>
          {orders.length ? (
            <Link href="/account/orders" className="text-sm text-olive underline underline-offset-4">
              All orders
            </Link>
          ) : null}
        </div>
        {orders.length ? (
          <ul className="divide-y divide-line rounded-2xl bg-plaster">
            {orders.map((order) => (
              <li key={order.id}>
                <Link href={`/account/orders/${order.number}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-white/60">
                  <span>
                    <span className="block font-medium">{order.number}</span>
                    <span className="text-sm text-ink-soft">{order.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <Badge tone={ORDER_STATUS_TONE[order.status]}>{orderStatusLabel(order.status, order.fulfillmentMethod)}</Badge>
                    <span className="text-[0.9375rem]">{formatMoney(order.total, currency)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-2xl bg-plaster p-6">
            <p className="text-ink-soft">You haven&apos;t ordered yet.</p>
            <ButtonLink href="/shop" className="mt-4">
              Browse the shop
            </ButtonLink>
          </div>
        )}
      </section>
    </div>
  );
}
