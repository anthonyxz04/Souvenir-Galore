"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import {
  BoxIcon,
  CardIcon,
  ChartIcon,
  ChatIcon,
  FileIcon,
  GridIcon,
  LayoutIcon,
  MailIcon,
  MenuIcon,
  PenIcon,
  SettingsIcon,
  ShieldIcon,
  StarIcon,
  TagIcon,
  TruckIcon,
  UsersIcon,
} from "@/components/ui/icons";

export type AdminNavItem = { href: string; label: string; icon: string; badge?: number };
export type AdminNavGroup = { label: string; items: AdminNavItem[] };

const ICONS: Record<string, (p: { size?: number }) => React.ReactNode> = {
  chart: ChartIcon,
  box: BoxIcon,
  grid: GridIcon,
  tag: TagIcon,
  card: CardIcon,
  users: UsersIcon,
  pen: PenIcon,
  chat: ChatIcon,
  star: StarIcon,
  truck: TruckIcon,
  layout: LayoutIcon,
  file: FileIcon,
  mail: MailIcon,
  settings: SettingsIcon,
  shield: ShieldIcon,
};

function NavList({ groups }: { groups: AdminNavGroup[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Dashboard" className="space-y-6">
      {groups.map((group) => (
        <div key={group.label} className="space-y-1">
          <p className="px-3 text-xs font-medium text-white/50">{group.label}</p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = ICONS[item.icon] ?? GridIcon;
              const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2 text-[0.9375rem] transition-colors",
                      active ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    <Icon size={18} />
                    <span className="flex-1">{item.label}</span>
                    {item.badge ? <span className="rounded-full bg-wax px-2 py-0.5 text-xs font-semibold text-ink">{item.badge}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function AdminSidebar({ groups }: { groups: AdminNavGroup[] }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 overflow-y-auto bg-olive-deep px-3 py-5 lg:block print:hidden">
      <NavList groups={groups} />
    </aside>
  );
}

export function AdminMobileNav({ groups }: { groups: AdminNavGroup[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-ink/5 lg:hidden" aria-label="Open dashboard menu">
        <MenuIcon />
      </DialogTrigger>
      <DialogContent title="Dashboard" side="left" className="bg-olive-deep text-white [&_h2]:text-white">
        <NavList groups={groups} />
      </DialogContent>
    </Dialog>
  );
}
