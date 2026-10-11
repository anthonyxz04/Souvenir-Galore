"use client";

import Link from "next/link";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { UserIcon } from "@/components/ui/icons";
import { signOutAction } from "@/server/actions/auth";

export function AccountMenu({ user }: { user: { name: string; isStaff: boolean } | null }) {
  if (!user) {
    return (
      <Link href="/login" className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-ink/5" aria-label="Sign in">
        <UserIcon size={21} />
      </Link>
    );
  }
  const item = "block rounded-xl px-3 py-2 text-[0.9375rem] text-ink outline-none data-[highlighted]:bg-limestone";
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-ink/5 data-[state=open]:bg-ink/5" aria-label="Account menu">
        <UserIcon size={21} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className="z-50 min-w-56 rounded-2xl bg-plaster p-2 shadow-lift ring-1 ring-line">
          <DropdownMenu.Label className="px-3 pb-2 pt-1 text-sm text-ink-soft">Signed in as {user.name}</DropdownMenu.Label>
          <DropdownMenu.Item asChild>
            <Link href="/account" className={item}>
              My account
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild>
            <Link href="/account/orders" className={item}>
              Orders
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild>
            <Link href="/account/wishlist" className={item}>
              Wishlist
            </Link>
          </DropdownMenu.Item>
          {user.isStaff ? (
            <DropdownMenu.Item asChild>
              <Link href="/admin" className={item}>
                Store dashboard
              </Link>
            </DropdownMenu.Item>
          ) : null}
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <form action={signOutAction}>
            <button type="submit" className={`${item} w-full text-left hover:bg-limestone`}>
              Sign out
            </button>
          </form>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
