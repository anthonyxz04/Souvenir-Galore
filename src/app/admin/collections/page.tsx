import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guards";
import { moveCollectionAction } from "@/server/actions/admin/catalog";
import { AdminPageHeader, EmptyRow, formatDate, Table, Td, Th } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ArrowDownIcon, ArrowUpIcon } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Collections" };
const KIND: Record<string, string> = { STANDARD: "Collection", SEASONAL: "Seasonal", OCCASION: "Occasion", LIMITED: "Limited edition" };

export default async function CollectionsAdminPage() {
  await requireStaffPage("catalog:manage", "/admin/collections");
  const collections = await prisma.collection.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }], include: { _count: { select: { products: true } } } });
  const now = new Date();
  return (
    <div>
      <AdminPageHeader
        title="Collections"
        description="Group products for an occasion or season — Christmas, Mother's Day, weddings, a limited run. Schedule them with start and end dates."
        actions={<ButtonLink href="/admin/collections/new" size="sm">Add collection</ButtonLink>}
      />
      <Table>
        <thead>
          <tr>
            <Th>Collection</Th>
            <Th>Products</Th>
            <Th>Status</Th>
            <Th>Dates</Th>
            <Th className="text-right">Order</Th>
          </tr>
        </thead>
        <tbody>
          {collections.length ? (
            collections.map((collection) => {
              const live = collection.isPublished && (!collection.startsAt || collection.startsAt <= now) && (!collection.endsAt || collection.endsAt >= now);
              return (
                <tr key={collection.id}>
                  <Td>
                    <Link href={`/admin/collections/${collection.id}`} className="font-medium hover:underline">
                      {collection.name}
                    </Link>
                    <p className="text-xs text-ink-soft">{KIND[collection.kind]}</p>
                  </Td>
                  <Td className="tabular-nums">{collection._count.products}</Td>
                  <Td className="space-x-1">
                    <Badge tone={live ? "success" : collection.isPublished ? "warning" : "neutral"}>{live ? "Live" : collection.isPublished ? "Scheduled / ended" : "Hidden"}</Badge>
                    {collection.isFeatured ? <Badge tone="wax">Homepage</Badge> : null}
                  </Td>
                  <Td className="text-sm text-ink-soft">
                    {collection.startsAt || collection.endsAt ? `${formatDate(collection.startsAt)} – ${formatDate(collection.endsAt)}` : "Always"}
                  </Td>
                  <Td>
                    <div className="flex justify-end">
                      {(["up", "down"] as const).map((direction) => (
                        <form key={direction} action={moveCollectionAction}>
                          <input type="hidden" name="id" value={collection.id} />
                          <input type="hidden" name="direction" value={direction} />
                          <button type="submit" className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-ink/5" aria-label={`Move ${collection.name} ${direction}`}>
                            {direction === "up" ? <ArrowUpIcon size={16} /> : <ArrowDownIcon size={16} />}
                          </button>
                        </form>
                      ))}
                    </div>
                  </Td>
                </tr>
              );
            })
          ) : (
            <EmptyRow colSpan={5}>No collections yet.</EmptyRow>
          )}
        </tbody>
      </Table>
    </div>
  );
}
