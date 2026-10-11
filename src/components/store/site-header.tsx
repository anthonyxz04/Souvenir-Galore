import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/auth/permissions";
import { getCartCount } from "@/lib/cart/service";
import { getNavCategories, getPublishedCollections } from "@/lib/catalog/queries";
import { getAllSettings } from "@/lib/settings";
import { publicMediaBase } from "@/lib/storage";
import { prisma } from "@/lib/db";
import { mediaUrl } from "@/lib/storage/urls";
import { safeHref } from "@/lib/text";
import { cn } from "@/lib/utils";
import { BagIcon, ChevronDownIcon, HeartIcon } from "@/components/ui/icons";
import { Wordmark } from "./logo";
import { MobileNav } from "./mobile-nav";
import { SearchDialog } from "./search-dialog";
import { AccountMenu } from "./account-menu";

export async function SiteHeader() {
  const [settings, user, cartCount, categories, collections] = await Promise.all([
    getAllSettings(),
    getCurrentUser(),
    getCartCount(),
    getNavCategories(),
    getPublishedCollections(),
  ]);
  const logo = settings.store.logoAssetId
    ? await prisma.mediaAsset.findUnique({ where: { id: settings.store.logoAssetId }, select: { key: true, renditions: true, width: true, height: true } })
    : null;
  const base = publicMediaBase();
  const logoSrc = logo ? mediaUrl(base, logo, 320) : null;
  // Up to three categories fit beside "Shop all" on the widest screens; fewer on
  // narrower ones. Every category stays reachable from "Shop all" and the menu.
  const navCategories = categories.slice(0, 3);
  const navVisibility = (index: number) => (index === 0 ? "" : index === 1 ? "hidden xl:block" : "hidden 2xl:block");
  const featuredCollections = collections.slice(0, 8);

  return (
    <>
      {settings.announcement.enabled && settings.announcement.message ? (
        <div className="bg-olive text-white">
          <p className="mx-auto max-w-[1240px] px-4 py-2 text-center text-[0.8125rem] leading-snug">
            {safeHref(settings.announcement.href) ? (
              <Link href={safeHref(settings.announcement.href)!} className="underline-offset-4 hover:underline">
                {settings.announcement.message}
              </Link>
            ) : (
              settings.announcement.message
            )}
          </p>
        </div>
      ) : null}

      <header className="sticky top-0 z-40 border-b border-line/70 bg-limestone/95 backdrop-blur supports-[backdrop-filter]:bg-limestone/85">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:h-[4.5rem] lg:px-10">
          <MobileNav
            brand={{ name: settings.store.name, logoSrc }}
            categories={categories}
            collections={featuredCollections.map((c) => ({ name: c.name, slug: c.slug }))}
            signedIn={Boolean(user)}
            customOrders={settings.commerce.customOrdersEnabled}
          />

          <Link href="/" className="shrink-0 rounded-md" aria-label={`${settings.store.name} home`}>
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoSrc!} alt="" className="h-9 w-auto max-w-[200px] object-contain sm:h-10" width={logo.width ?? undefined} height={logo.height ?? undefined} />
            ) : (
              <Wordmark name={settings.store.name} />
            )}
          </Link>

          <nav aria-label="Main" className="ml-4 hidden min-w-0 flex-1 items-center gap-0.5 whitespace-nowrap lg:flex xl:ml-6">
            <Link href="/shop" className="rounded-full px-3 py-2 text-[0.9375rem] text-ink hover:bg-ink/5">
              Shop all
            </Link>
            {navCategories.map((category, index) =>
              category.children.length ? (
                <div key={category.id} className={cn("group relative", navVisibility(index))}>
                  <Link
                    href={`/category/${category.slug}`}
                    className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-[0.9375rem] text-ink hover:bg-ink/5"
                  >
                    {category.name}
                    <ChevronDownIcon size={14} className="text-ink-soft transition-transform group-hover:rotate-180" />
                  </Link>
                  <div className="invisible absolute left-0 top-full z-50 pt-2 opacity-0 transition-opacity duration-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                    <ul className="min-w-60 rounded-2xl bg-plaster p-2 shadow-lift ring-1 ring-line">
                      {category.children.map((child) => (
                        <li key={child.id}>
                          <Link href={`/category/${child.slug}`} className="block rounded-xl px-3 py-2 text-[0.9375rem] hover:bg-limestone">
                            {child.name}
                          </Link>
                        </li>
                      ))}
                      <li className="mt-1 border-t border-line pt-1">
                        <Link href={`/category/${category.slug}`} className="block rounded-xl px-3 py-2 text-sm text-ink-soft hover:bg-limestone hover:text-ink">
                          All {category.name.toLowerCase()}
                        </Link>
                      </li>
                    </ul>
                  </div>
                </div>
              ) : (
                <Link key={category.id} href={`/category/${category.slug}`} className={cn("rounded-full px-3 py-2 text-[0.9375rem] text-ink hover:bg-ink/5", navVisibility(index))}>
                  {category.name}
                </Link>
              ),
            )}
            {featuredCollections.length ? (
              <div className="group relative">
                <Link href="/collections" className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-[0.9375rem] text-ink hover:bg-ink/5">
                  Collections
                  <ChevronDownIcon size={14} className="text-ink-soft transition-transform group-hover:rotate-180" />
                </Link>
                <div className="invisible absolute left-0 top-full z-50 pt-2 opacity-0 transition-opacity duration-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                  <ul className="min-w-60 rounded-2xl bg-plaster p-2 shadow-lift ring-1 ring-line">
                    {featuredCollections.map((collection) => (
                      <li key={collection.id}>
                        <Link href={`/collections/${collection.slug}`} className="block rounded-xl px-3 py-2 text-[0.9375rem] hover:bg-limestone">
                          {collection.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}
            {settings.commerce.customOrdersEnabled ? (
              <Link href="/custom-order" className="rounded-full px-3 py-2 text-[0.9375rem] text-ink hover:bg-ink/5">
                Custom orders
              </Link>
            ) : null}
          </nav>

          <div className="ml-auto flex items-center gap-0.5">
            <SearchDialog />
            <AccountMenu user={user ? { name: user.name, isStaff: isStaffRole(user.role) } : null} />
            {user ? (
              <Link href="/account/wishlist" className="hidden h-11 w-11 items-center justify-center rounded-full hover:bg-ink/5 sm:inline-flex" aria-label="Wishlist">
                <HeartIcon size={21} />
              </Link>
            ) : null}
            <Link href="/cart" className="relative inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-ink/5" aria-label={`Cart, ${cartCount} ${cartCount === 1 ? "item" : "items"}`}>
              <BagIcon size={22} />
              {cartCount > 0 ? (
                <span className="absolute right-0.5 top-0.5 inline-flex h-[1.15rem] min-w-[1.15rem] items-center justify-center rounded-full bg-olive px-1 text-[0.6875rem] font-semibold leading-none text-white" aria-hidden>
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              ) : null}
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}
