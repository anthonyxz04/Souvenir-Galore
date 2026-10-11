import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guards";
import { publicMediaBase } from "@/lib/storage";
import { mediaUrl } from "@/lib/storage/urls";
import { addProductToCollectionAction, deleteCollectionAction, moveCollectionProductAction, removeProductFromCollectionAction } from "@/server/actions/admin/catalog";
import { AdminPageHeader, Panel } from "@/components/admin/admin-ui";
import { CollectionForm } from "@/components/admin/catalog-forms";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { ArrowDownIcon, ArrowUpIcon } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Edit collection" };

export default async function EditCollectionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string }> }) {
  const { id } = await params;
  await requireStaffPage("catalog:manage", `/admin/collections/${id}`);
  const { q } = await searchParams;
  const collection = await prisma.collection.findUnique({
    where: { id },
    include: {
      image: { select: { key: true, renditions: true } },
      products: { orderBy: { position: "asc" }, include: { product: { select: { id: true, name: true, status: true } } } },
    },
  });
  if (!collection) notFound();
  const base = publicMediaBase();
  const inCollection = new Set(collection.products.map((p) => p.productId));
  const search = q?.trim().slice(0, 100);
  const candidates = search
    ? await prisma.product.findMany({ where: { name: { contains: search, mode: "insensitive" }, status: { not: "ARCHIVED" } }, take: 12, select: { id: true, name: true } })
    : [];
  const date = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        back={{ href: "/admin/collections", label: "Collections" }}
        title={collection.name}
        actions={
          <>
            <Link href={`/collections/${collection.slug}`} target="_blank" className="text-sm underline underline-offset-4">
              View in store
            </Link>
            <ConfirmButton action={deleteCollectionAction} fields={{ id: collection.id }} label="Delete" title={`Delete ${collection.name}?`} description="Products aren't deleted — they're only removed from this collection." confirmLabel="Delete collection" />
          </>
        }
      />
      <Panel>
        <CollectionForm
          initial={{
            id: collection.id,
            name: collection.name,
            slug: collection.slug,
            description: collection.description,
            kind: collection.kind,
            imageId: collection.imageId,
            imageUrl: collection.image ? mediaUrl(base, collection.image, 640) : null,
            startsAt: date(collection.startsAt),
            endsAt: date(collection.endsAt),
            seoTitle: collection.seoTitle,
            seoDescription: collection.seoDescription,
            isPublished: collection.isPublished,
            isFeatured: collection.isFeatured,
          }}
        />
      </Panel>

      <Panel title={`Products (${collection.products.length})`} description="The order here is the order on the collection page when sorted by Featured.">
        <form method="get" className="mb-4 flex flex-wrap gap-2">
          <label htmlFor="add-product" className="sr-only">
            Find a product to add
          </label>
          <input id="add-product" name="q" defaultValue={search} placeholder="Find a product to add" className="h-10 min-w-64 flex-1 rounded-full border border-line-strong/70 bg-white px-4 text-sm focus:border-olive focus:outline-none" />
          <button type="submit" className="h-10 rounded-full bg-ink px-4 text-sm text-white">
            Search
          </button>
        </form>
        {candidates.length ? (
          <ul className="mb-6 space-y-1 rounded-xl bg-white/70 p-2">
            {candidates.map((product) => (
              <li key={product.id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-1.5">
                <span>{product.name}</span>
                {inCollection.has(product.id) ? (
                  <span className="text-sm text-ink-soft">Already added</span>
                ) : (
                  <form action={addProductToCollectionAction}>
                    <input type="hidden" name="collectionId" value={collection.id} />
                    <input type="hidden" name="productId" value={product.id} />
                    <button type="submit" className="text-sm text-olive underline underline-offset-4">
                      Add
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        ) : search ? (
          <p className="mb-6 text-sm text-ink-soft">No products match “{search}”.</p>
        ) : null}
        {collection.products.length ? (
          <ol className="divide-y divide-line/70">
            {collection.products.map((item, index) => (
              <li key={item.productId} className="flex items-center justify-between gap-3 py-2">
                <span className="flex items-center gap-3">
                  <span className="w-6 text-right text-sm text-ink-soft tabular-nums">{index + 1}</span>
                  <Link href={`/admin/products/${item.product.id}`} className="hover:underline">
                    {item.product.name}
                  </Link>
                  {item.product.status !== "ACTIVE" ? <span className="text-xs text-wax-ink">{item.product.status === "DRAFT" ? "Draft" : "Archived"}</span> : null}
                </span>
                <span className="flex items-center gap-1">
                  {(["up", "down"] as const).map((direction) => (
                    <form key={direction} action={moveCollectionProductAction}>
                      <input type="hidden" name="collectionId" value={collection.id} />
                      <input type="hidden" name="productId" value={item.productId} />
                      <input type="hidden" name="direction" value={direction} />
                      <button type="submit" className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-ink/5" aria-label={`Move ${item.product.name} ${direction}`}>
                        {direction === "up" ? <ArrowUpIcon size={16} /> : <ArrowDownIcon size={16} />}
                      </button>
                    </form>
                  ))}
                  <form action={removeProductFromCollectionAction}>
                    <input type="hidden" name="collectionId" value={collection.id} />
                    <input type="hidden" name="productId" value={item.productId} />
                    <button type="submit" className="h-8 rounded-full px-3 text-sm text-wine hover:bg-wine-soft">
                      Remove
                    </button>
                  </form>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-ink-soft">No products in this collection yet.</p>
        )}
      </Panel>
    </div>
  );
}
