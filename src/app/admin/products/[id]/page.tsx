import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guards";
import { productEditorChoices } from "@/lib/catalog/admin-choices";
import { absoluteUrl } from "@/lib/env";
import { toMajorString } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { publicMediaBase } from "@/lib/storage";
import { mediaUrl } from "@/lib/storage/urls";
import { deleteProductAction, duplicateProductAction } from "@/server/actions/admin/products";
import { AdminPageHeader, formatDateTime, Panel } from "@/components/admin/admin-ui";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { ProductEditor, type EditorProduct } from "@/components/admin/product-editor";
import { Notice } from "@/components/ui/form-message";
import { buttonClass } from "@/components/ui/button";

export const metadata: Metadata = { title: "Edit product" };

const REASON_LABEL: Record<string, string> = {
  ORDER_PLACED: "Order",
  ORDER_CANCELLED: "Order cancelled",
  MANUAL_ADJUSTMENT: "Adjustment",
  RESTOCK: "Restock",
  RETURN: "Return",
};

export default async function EditProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; duplicated?: string }> }) {
  const { id } = await params;
  await requireStaffPage("products:manage", `/admin/products/${id}`);
  const flags = await searchParams;
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      options: { orderBy: { position: "asc" } },
      variants: { orderBy: { position: "asc" } },
      images: { orderBy: { position: "asc" }, include: { asset: { select: { key: true, renditions: true } } } },
      personalizationFields: { orderBy: { position: "asc" } },
      categories: true,
      collections: true,
      tags: true,
      _count: { select: { orderItems: true } },
    },
  });
  if (!product) notFound();
  const [choices, commerce, movements] = await Promise.all([
    productEditorChoices(),
    getSettings("commerce"),
    prisma.inventoryMovement.findMany({
      where: { variant: { productId: id } },
      orderBy: { createdAt: "desc" },
      take: 15,
      include: { variant: { select: { title: true } }, order: { select: { id: true, number: true } } },
    }),
  ]);
  const d = commerce.currencyDecimals;
  const base = publicMediaBase();
  const activeVariants = product.variants.filter((v) => v.isActive || product.variants.length === 1 || product.options.length > 0);

  const initial: EditorProduct = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    shortDescription: product.shortDescription ?? "",
    description: product.description ?? "",
    status: product.status,
    pricingType: product.pricingType,
    isFeatured: product.isFeatured,
    isBestseller: product.isBestseller,
    isLimitedEdition: product.isLimitedEdition,
    trackInventory: product.trackInventory,
    allowBackorder: product.allowBackorder,
    madeToOrder: product.madeToOrder,
    allowInquiry: product.allowInquiry,
    lowStockThreshold: product.lowStockThreshold,
    prepTimeMinDays: product.prepTimeMinDays,
    prepTimeMaxDays: product.prepTimeMaxDays,
    maxPerOrder: product.maxPerOrder,
    saleStartsAt: product.saleStartsAt?.toISOString() ?? null,
    saleEndsAt: product.saleEndsAt?.toISOString() ?? null,
    seoTitle: product.seoTitle ?? "",
    seoDescription: product.seoDescription ?? "",
    options: product.options.map((o) => ({ name: o.name, values: o.values })),
    variants: activeVariants
      .filter((v) => (product.options.length === 0 ? true : v.option1 !== null))
      .map((v) => ({
        id: v.id,
        option1: v.option1,
        option2: v.option2,
        option3: v.option3,
        sku: v.sku ?? "",
        price: toMajorString(v.price, d),
        salePrice: v.salePrice === null ? "" : toMajorString(v.salePrice, d),
        costPrice: v.costPrice === null ? "" : toMajorString(v.costPrice, d),
        stock: v.stock,
        isActive: v.isActive,
      })),
    personalizationFields: product.personalizationFields.map((f) => ({
      id: f.id,
      label: f.label,
      type: f.type,
      isRequired: f.isRequired,
      maxLength: f.maxLength,
      options: f.options,
      priceDelta: f.priceDelta ? toMajorString(f.priceDelta, d) : "",
      placeholder: f.placeholder,
      helpText: f.helpText,
    })),
    images: product.images.map((image) => ({ assetId: image.assetId, alt: image.alt ?? "", url: mediaUrl(base, image.asset, 640) })),
    categoryIds: product.categories.map((c) => c.categoryId),
    collectionIds: product.collections.map((c) => c.collectionId),
    tagIds: product.tags.map((t) => t.tagId),
  };
  if (initial.variants.length === 0) {
    initial.variants = [{ option1: null, option2: null, option3: null, sku: "", price: "", salePrice: "", costPrice: "", stock: 0, isActive: true }];
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        back={{ href: "/admin/products", label: "Products" }}
        title={product.name}
        description={`Last updated ${formatDateTime(product.updatedAt)}`}
        actions={
          <>
            <form action={duplicateProductAction}>
              <input type="hidden" name="productId" value={product.id} />
              <button type="submit" className={buttonClass("secondary", "sm")}>
                Duplicate
              </button>
            </form>
            <ConfirmButton
              action={deleteProductAction}
              fields={{ productId: product.id }}
              label={product._count.orderItems ? "Archive" : "Delete"}
              title={product._count.orderItems ? "Archive this product?" : "Delete this product?"}
              description={
                product._count.orderItems
                  ? "It has been ordered before, so it will be archived (hidden from the store) to keep order records intact."
                  : "This permanently removes the product. Photos stay in your media library."
              }
              confirmLabel={product._count.orderItems ? "Archive product" : "Delete product"}
            />
          </>
        }
      />
      {flags.created ? <Notice tone="success">Product created. Set the status to Active when it&apos;s ready for customers.</Notice> : null}
      {flags.duplicated ? <Notice tone="success">This is a copy, saved as a draft. Update the name, photos and stock before publishing.</Notice> : null}
      <ProductEditor initial={initial} choices={{ ...choices, currencyCode: commerce.currencyCode, storeUrl: absoluteUrl("/") }} />
      {movements.length ? (
        <Panel title="Recent stock changes" padded={false}>
          <ul className="divide-y divide-line/70 text-sm">
            {movements.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
                <span>
                  {REASON_LABEL[m.reason]}
                  {m.order ? (
                    <>
                      {" "}
                      <Link href={`/admin/orders/${m.order.id}`} className="underline">
                        {m.order.number}
                      </Link>
                    </>
                  ) : null}
                  {m.variant.title !== "Default" ? <span className="text-ink-soft">, {m.variant.title}</span> : null}
                  {m.note ? <span className="text-ink-soft"> — {m.note}</span> : null}
                </span>
                <span className="tabular-nums">
                  <span className={m.delta > 0 ? "text-olive" : "text-wine"}>{m.delta > 0 ? `+${m.delta}` : m.delta}</span>
                  {m.stockAfter !== null ? <span className="text-ink-soft"> → {m.stockAfter}</span> : null}
                  <span className="ml-3 text-ink-soft">{formatDateTime(m.createdAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
