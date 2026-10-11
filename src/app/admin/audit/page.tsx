import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guards";
import { AdminPageHeader, EmptyRow, FilterBar, FilterSearch, formatDateTime, Table, Td, Th } from "@/components/admin/admin-ui";
import { Pagination } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Activity log" };
const PER_PAGE = 50;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireStaffPage("audit:view", "/admin/audit");
  const { q, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const search = q?.trim().slice(0, 100);
  const where = search
    ? { OR: [{ action: { contains: search, mode: "insensitive" as const } }, { actorEmail: { contains: search, mode: "insensitive" as const } }, { summary: { contains: search, mode: "insensitive" as const } }] }
    : {};
  const [total, entries] = await Promise.all([prisma.auditLog.count({ where }), prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE })]);
  return (
    <div>
      <AdminPageHeader title="Activity log" description="Who changed what in the dashboard, plus sign-ins and failed sign-in attempts. IP addresses are stored only as anonymous fingerprints." />
      <FilterBar>
        <FilterSearch value={search} placeholder="Action, person or detail" />
      </FilterBar>
      <Table>
        <thead>
          <tr>
            <Th>When</Th>
            <Th>Who</Th>
            <Th>Action</Th>
            <Th>Details</Th>
          </tr>
        </thead>
        <tbody>
          {entries.length ? (
            entries.map((entry) => (
              <tr key={entry.id}>
                <Td className="whitespace-nowrap text-sm text-ink-soft">{formatDateTime(entry.createdAt)}</Td>
                <Td className="text-sm">{entry.actorEmail ?? "System / visitor"}</Td>
                <Td className="font-mono text-xs">{entry.action}</Td>
                <Td className="text-sm">{entry.summary ?? "—"}</Td>
              </tr>
            ))
          ) : (
            <EmptyRow colSpan={4}>No activity recorded yet.</EmptyRow>
          )}
        </tbody>
      </Table>
      <div className="mt-6">
        <Pagination page={page} pageCount={Math.max(1, Math.ceil(total / PER_PAGE))} hrefFor={(p) => `/admin/audit?${new URLSearchParams({ ...(search ? { q: search } : {}), ...(p > 1 ? { page: String(p) } : {}) }).toString()}`} />
      </div>
    </div>
  );
}
