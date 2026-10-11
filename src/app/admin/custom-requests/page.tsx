import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guards";
import { CUSTOM_REQUEST_STATUSES } from "@/lib/domain";
import { CUSTOM_REQUEST_STATUS_LABEL, CUSTOM_REQUEST_STATUS_TONE } from "@/lib/requests";
import { AdminPageHeader, EmptyRow, FilterBar, FilterSearch, FilterSelect, formatDate, Table, Td, Th } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Custom requests" };

export default async function CustomRequestsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  await requireStaffPage("requests:manage", "/admin/custom-requests");
  const { q, status } = await searchParams;
  const search = q?.trim().slice(0, 100);
  const where: Prisma.CustomRequestWhereInput = {
    ...(status && (CUSTOM_REQUEST_STATUSES as readonly string[]).includes(status) ? { status: status as Prisma.CustomRequestWhereInput["status"] } : {}),
    ...(search
      ? { OR: [{ number: { contains: search, mode: "insensitive" } }, { name: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }, { productType: { contains: search, mode: "insensitive" } }] }
      : {}),
  };
  const requests = await prisma.customRequest.findMany({ where, orderBy: { createdAt: "desc" }, take: 200, include: { _count: { select: { attachments: true } } } });
  return (
    <div>
      <AdminPageHeader title="Custom requests" description="Requests for made-to-order pieces. Reply with questions or a quote; nothing is charged until the customer agrees." />
      <FilterBar>
        <FilterSearch value={search} placeholder="Number, name, email, product" />
        <FilterSelect name="status" label="Status" value={status} options={[{ value: "", label: "Any" }, ...CUSTOM_REQUEST_STATUSES.map((s) => ({ value: s, label: CUSTOM_REQUEST_STATUS_LABEL[s] }))]} />
      </FilterBar>
      <Table>
        <thead>
          <tr>
            <Th>Request</Th>
            <Th>Customer</Th>
            <Th>Occasion</Th>
            <Th>Needed by</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {requests.length ? (
            requests.map((r) => (
              <tr key={r.id}>
                <Td>
                  <Link href={`/admin/custom-requests/${r.id}`} className="font-medium hover:underline">
                    {r.number}
                  </Link>
                  <p className="text-xs text-ink-soft">
                    {r.productType}
                    {r.quantity ? `, ×${r.quantity}` : ""}
                    {r._count.attachments ? `, ${r._count.attachments} image${r._count.attachments > 1 ? "s" : ""}` : ""}
                  </p>
                </Td>
                <Td>
                  <p>{r.name}</p>
                  <p className="text-xs text-ink-soft">{formatDate(r.createdAt)}</p>
                </Td>
                <Td className="text-sm">{r.occasion ?? "—"}</Td>
                <Td className="text-sm">{r.desiredDate ? r.desiredDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—"}</Td>
                <Td>
                  <Badge tone={CUSTOM_REQUEST_STATUS_TONE[r.status]}>{CUSTOM_REQUEST_STATUS_LABEL[r.status]}</Badge>
                </Td>
              </tr>
            ))
          ) : (
            <EmptyRow colSpan={5}>No custom requests yet.</EmptyRow>
          )}
        </tbody>
      </Table>
    </div>
  );
}
