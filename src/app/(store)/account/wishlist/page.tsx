import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { getProductCardsByIds } from "@/lib/catalog/queries";
import { getCurrency } from "@/lib/settings";
import { publicMediaBase } from "@/lib/storage";
import { toggleWishlistAction } from "@/server/actions/account";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { ProductCard } from "@/components/store/product-card";

export const metadata: Metadata = { title: "Wishlist" };

export default async function WishlistPage() {
  const user = await requireUser("/account/wishlist");
  const items = await prisma.wishlistItem.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, select: { productId: true } });
  const [products, currency] = await Promise.all([getProductCardsByIds(items.map((i) => i.productId)), getCurrency()]);
  const base = publicMediaBase();
  return (
    <div className="space-y-8">
      <h1 className="font-display text-[2.25rem] leading-tight sm:text-title">Wishlist</h1>
      {products.length ? (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3">
          {products.map((product) => (
            <li key={product.id} className="space-y-3">
              <ProductCard product={product} base={base} currency={currency} />
              <form action={toggleWishlistAction} className="relative z-10">
                <input type="hidden" name="productId" value={product.id} />
                <input type="hidden" name="returnTo" value="/account/wishlist" />
                <button type="submit" className="text-sm text-ink-soft underline underline-offset-4 hover:text-wine">
                  Remove<span className="sr-only"> {product.name}</span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="Nothing saved yet" action={<ButtonLink href="/shop">Browse the shop</ButtonLink>}>
          Tap “Save to wishlist” on any product to keep it here.
        </EmptyState>
      )}
    </div>
  );
}
