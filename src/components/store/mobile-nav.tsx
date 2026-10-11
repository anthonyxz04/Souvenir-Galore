"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { ChevronDownIcon, MenuIcon } from "@/components/ui/icons";
import { Wordmark } from "./logo";

type Category = { id: string; name: string; slug: string; children: { id: string; name: string; slug: string }[] };

export function MobileNav({
  categories,
  collections,
  signedIn,
  customOrders,
  brand,
}: {
  brand: { name: string; logoSrc: string | null };
  categories: Category[];
  collections: { name: string; slug: string }[];
  signedIn: boolean;
  customOrders: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);

  const linkClass = "block rounded-xl px-3 py-3 text-[1.0625rem] text-ink hover:bg-limestone";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="-ml-2 inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-ink/5 lg:hidden" aria-label="Open menu">
        <MenuIcon size={22} />
      </DialogTrigger>
      <DialogContent title="Menu" hideTitle side="left" className="bg-plaster">
        <Link href="/" className="mb-5 inline-flex max-w-[80%] rounded-md" aria-label={`${brand.name} home`}>
          {brand.logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoSrc} alt="" className="h-9 w-auto max-w-full object-contain" />
          ) : (
            <Wordmark name={brand.name} />
          )}
        </Link>
        <nav aria-label="Mobile" className="-mx-2 space-y-1 pb-8">
          <Link href="/shop" className={linkClass}>
            Shop all
          </Link>
          {categories.map((category) =>
            category.children.length ? (
              <details key={category.id} className="group">
                <summary className="flex items-center justify-between rounded-xl px-3 py-3 text-[1.0625rem] hover:bg-limestone">
                  {category.name}
                  <ChevronDownIcon size={18} className="text-ink-soft transition-transform group-open:rotate-180" />
                </summary>
                <div className="ml-3 border-l border-line pl-2">
                  <Link href={`/category/${category.slug}`} className="block rounded-xl px-3 py-2.5 text-ink-soft hover:bg-limestone">
                    All {category.name.toLowerCase()}
                  </Link>
                  {category.children.map((child) => (
                    <Link key={child.id} href={`/category/${child.slug}`} className="block rounded-xl px-3 py-2.5 hover:bg-limestone">
                      {child.name}
                    </Link>
                  ))}
                </div>
              </details>
            ) : (
              <Link key={category.id} href={`/category/${category.slug}`} className={linkClass}>
                {category.name}
              </Link>
            ),
          )}
          {collections.length ? (
            <details className="group">
              <summary className="flex items-center justify-between rounded-xl px-3 py-3 text-[1.0625rem] hover:bg-limestone">
                Collections
                <ChevronDownIcon size={18} className="text-ink-soft transition-transform group-open:rotate-180" />
              </summary>
              <div className="ml-3 border-l border-line pl-2">
                {collections.map((collection) => (
                  <Link key={collection.slug} href={`/collections/${collection.slug}`} className="block rounded-xl px-3 py-2.5 hover:bg-limestone">
                    {collection.name}
                  </Link>
                ))}
              </div>
            </details>
          ) : null}
          <Link href="/gifts" className={linkClass}>
            Gift finder
          </Link>
          {customOrders ? (
            <Link href="/custom-order" className={linkClass}>
              Custom orders
            </Link>
          ) : null}
          <div className="my-3 border-t border-line" />
          <Link href={signedIn ? "/account" : "/login"} className={linkClass}>
            {signedIn ? "My account" : "Sign in"}
          </Link>
          {signedIn ? (
            <Link href="/account/wishlist" className={linkClass}>
              Wishlist
            </Link>
          ) : null}
          <Link href="/contact" className={linkClass}>
            Contact
          </Link>
          <Link href="/faq" className={linkClass}>
            Questions
          </Link>
        </nav>
      </DialogContent>
    </Dialog>
  );
}
