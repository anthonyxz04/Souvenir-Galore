"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/server/actions/auth";

const LINKS = [
  { href: "/account", label: "Overview" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/custom-requests", label: "Custom requests" },
  { href: "/account/wishlist", label: "Wishlist" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/profile", label: "Profile" },
  { href: "/account/security", label: "Password & security" },
];

export function AccountNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Account">
      <ul className="scrollbar-none -mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:block lg:space-y-0.5 lg:px-0">
        {LINKS.map((link) => {
          const active = link.href === "/account" ? pathname === "/account" : pathname.startsWith(link.href);
          return (
            <li key={link.href} className="shrink-0">
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn("block whitespace-nowrap rounded-full px-4 py-2 text-[0.9375rem] lg:rounded-xl", active ? "bg-ink text-white" : "text-ink hover:bg-ink/5")}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
        <li className="shrink-0 lg:mt-3 lg:border-t lg:border-line lg:pt-3">
          <form action={signOutAction}>
            <button type="submit" className="block whitespace-nowrap rounded-full px-4 py-2 text-left text-[0.9375rem] text-ink-soft hover:bg-ink/5 hover:text-ink lg:w-full lg:rounded-xl">
              Sign out
            </button>
          </form>
        </li>
      </ul>
    </nav>
  );
}
