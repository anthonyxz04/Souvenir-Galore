import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guards";
import { AdminPageHeader, EmptyRow, FilterBar, FilterSearch, formatDate, Table, Td, Th } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Customers" };
const PER_PAGE = 40;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireStaffPage("customers:view", "/admin/customers");
  const { q, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const search = q?.trim().slice(0, 100);
  const where: Prisma.UserWhereInput = {
    role: "CUSTOMER",
    deletedAt: null,
    ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }, { phone: { contains: search } }] } : {}),
  };
  const [total, customers] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: { id: true, name: true, email: true, phone: true, createdAt: true, emailVerifiedAt: true, marketingOptIn: true, disabledAt: true, _count: { select: { orders: true } } },
    }),
  ]);
  return (
    <div>
      <AdminPageHeader title="Customers" description="Registered customer accounts. Guest orders appear in Orders. Passwords are never visible to anyone." />
      <FilterBar>
        <FilterSearch value={search} placeholder="Name, email or phone" />
      </FilterBar>
      <Table>
        <thead>
          <tr>
            <Th>Customer</Th>
            <Th>Phone</Th>
            <Th>Joined</Th>
            <Th className="text-right">Orders</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {customers.length ? (
            customers.map((c) => (
              <tr key={c.id}>
                <Td>
                  <Link href={`/admin/customers/${c.id}`} className="font-medium hover:underline">
                    {c.name}
                  </Link>
                  <p className="text-xs text-ink-soft">{c.email}</p>
                </Td>
                <Td className="text-sm">{c.phone ?? "—"}</Td>
                <Td className="text-sm text-ink-soft">{formatDate(c.createdAt)}</Td>
                <Td className="text-right tabular-nums">{c._count.orders}</Td>
                <Td className="space-x-1">
                  {c.disabledAt ? <Badge tone="danger">Disabled</Badge> : c.emailVerifiedAt ? <Badge tone="success">Verified</Badge> : <Badge tone="warning">Unverified</Badge>}
                  {c.marketingOptIn ? <Badge>Marketing</Badge> : null}
                </Td>
              </tr>
            ))
          ) : (
            <EmptyRow colSpan={5}>No customers found.</EmptyRow>
          )}
        </tbody>
      </Table>
      <div className="mt-6">
        <Pagination page={page} pageCount={Math.max(1, Math.ceil(total / PER_PAGE))} hrefFor={(p) => `/admin/customers?${new URLSearchParams({ ...(search ? { q: search } : {}), ...(p > 1 ? { page: String(p) } : {}) }).toString()}`} />
      </div>
    </div>
  );
}
