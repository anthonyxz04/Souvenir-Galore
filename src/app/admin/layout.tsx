import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guards";
import { hasPermission, ROLE_LABEL, type Permission } from "@/lib/auth/permissions";
import { getSettings } from "@/lib/settings";
import { signOutAction } from "@/server/actions/auth";
import { AdminMobileNav, AdminSidebar, type AdminNavGroup } from "@/components/admin/admin-nav";
import { ExternalIcon } from "@/components/ui/icons";
import { SealMark } from "@/components/store/logo";

export async function generateMetadata(): Promise<Metadata> {
  const store = await getSettings("store");
  return { title: { absolute: `Dashboard | ${store.name}`, template: `%s | Dashboard | ${store.name}` }, robots: { index: false, follow: false } };
}
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaffPage("dashboard:view");
  const can = (p: Permission) => hasPermission(user.role, p);

  const [store, pendingOrders, toVerify, newRequests, newInquiries, pendingReviews] = await Promise.all([
    getSettings("store"),
    can("orders:view") ? prisma.order.count({ where: { status: "PENDING" } }) : 0,
    can("payments:verify") ? prisma.order.count({ where: { paymentStatus: "UNDER_REVIEW", status: { not: "CANCELLED" } } }) : 0,
    can("requests:manage") ? prisma.customRequest.count({ where: { status: "NEW" } }) : 0,
    can("requests:manage") ? prisma.inquiry.count({ where: { status: "NEW" } }) : 0,
    can("reviews:manage") ? prisma.review.count({ where: { status: "PENDING" } }) : 0,
  ]);

  const groups: AdminNavGroup[] = [
    {
      label: "Overview",
      items: [{ href: "/admin", label: "Dashboard", icon: "chart" }],
    },
    {
      label: "Sales",
      items: [
        can("orders:view") ? { href: "/admin/orders", label: "Orders", icon: "box", badge: pendingOrders + toVerify || undefined } : null,
        can("customers:view") ? { href: "/admin/customers", label: "Customers", icon: "users" } : null,
        can("requests:manage") ? { href: "/admin/custom-requests", label: "Custom requests", icon: "pen", badge: newRequests || undefined } : null,
        can("requests:manage") ? { href: "/admin/inquiries", label: "Messages", icon: "chat", badge: newInquiries || undefined } : null,
        can("discounts:manage") ? { href: "/admin/discounts", label: "Discounts", icon: "tag" } : null,
      ].filter(Boolean) as AdminNavGroup["items"],
    },
    {
      label: "Catalog",
      items: [
        can("products:manage") ? { href: "/admin/products", label: "Products", icon: "grid" } : null,
        can("products:manage") ? { href: "/admin/inventory", label: "Inventory", icon: "box" } : null,
        can("catalog:manage") ? { href: "/admin/categories", label: "Categories", icon: "layout" } : null,
        can("catalog:manage") ? { href: "/admin/collections", label: "Collections", icon: "star" } : null,
        can("catalog:manage") ? { href: "/admin/attributes", label: "Filters & tags", icon: "tag" } : null,
        can("reviews:manage") ? { href: "/admin/reviews", label: "Reviews", icon: "star", badge: pendingReviews || undefined } : null,
      ].filter(Boolean) as AdminNavGroup["items"],
    },
    {
      label: "Content",
      items: [
        can("content:manage") ? { href: "/admin/homepage", label: "Homepage", icon: "layout" } : null,
        can("content:manage") ? { href: "/admin/pages", label: "Pages & policies", icon: "file" } : null,
        can("content:manage") ? { href: "/admin/faq", label: "FAQ", icon: "chat" } : null,
        can("newsletter:manage") ? { href: "/admin/newsletter", label: "Newsletter", icon: "mail" } : null,
      ].filter(Boolean) as AdminNavGroup["items"],
    },
    {
      label: "Store",
      items: [
        can("payment-methods:manage") ? { href: "/admin/payments", label: "Payments", icon: "card", badge: toVerify || undefined } : null,
        can("settings:manage") ? { href: "/admin/delivery", label: "Delivery & pickup", icon: "truck" } : null,
        can("settings:manage") ? { href: "/admin/settings", label: "Settings", icon: "settings" } : null,
        can("staff:manage") ? { href: "/admin/staff", label: "Staff", icon: "users" } : null,
        can("audit:view") ? { href: "/admin/audit", label: "Activity log", icon: "shield" } : null,
      ].filter(Boolean) as AdminNavGroup["items"],
    },
  ].filter((group) => group.items.length > 0);

  return (
    <div className="flex min-h-dvh bg-limestone print:bg-white">
      <AdminSidebar groups={groups} />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-14 print:hidden items-center gap-3 border-b border-line bg-limestone/95 px-4 backdrop-blur sm:px-6">
          <AdminMobileNav groups={groups} />
          <Link href="/admin" className="flex items-center gap-2">
            <SealMark size={26} />
            <span className="font-display text-lg">{store.name}</span>
          </Link>
          <div className="ml-auto flex items-center gap-1 text-sm">
            <Link href="/" target="_blank" className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-ink-soft hover:bg-ink/5 hover:text-ink sm:inline-flex">
              View store <ExternalIcon size={15} />
            </Link>
            <span className="hidden px-2 text-ink-soft md:inline">
              {user.name} ({ROLE_LABEL[user.role]})
            </span>
            <form action={signOutAction}>
              <button type="submit" className="rounded-full px-3 py-2 text-ink-soft hover:bg-ink/5 hover:text-ink">
                Sign out
              </button>
            </form>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
