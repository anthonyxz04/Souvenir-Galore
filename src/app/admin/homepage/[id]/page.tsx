import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guards";
import { categoryTree } from "@/lib/catalog/admin-choices";
import { SECTION_TYPE_INFO } from "@/lib/content/home";
import { publicMediaBase } from "@/lib/storage";
import { mediaUrl } from "@/lib/storage/urls";
import { deleteHomeSectionAction } from "@/server/actions/admin/content";
import { AdminPageHeader, Panel } from "@/components/admin/admin-ui";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { HomeSectionForm } from "@/components/admin/home-section-form";

export const metadata: Metadata = { title: "Homepage section" };

export default async function HomeSectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStaffPage("content:manage", `/admin/homepage/${id}`);
  const section = await prisma.homeSection.findUnique({
    where: { id },
    include: { image: { select: { key: true, renditions: true } }, items: { orderBy: { position: "asc" }, include: { image: { select: { key: true, renditions: true } } } } },
  });
  if (!section) notFound();
  const base = publicMediaBase();
  const [products, categories, collections] = await Promise.all([
    section.type === "PRODUCT_GRID" ? prisma.product.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true }, take: 500 }) : [],
    categoryTree(),
    prisma.collection.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);
  const info = SECTION_TYPE_INFO[section.type];
  return (
    <div className="space-y-6">
      <AdminPageHeader
        back={{ href: "/admin/homepage", label: "Homepage" }}
        title={info.label}
        description={info.description}
        actions={<ConfirmButton action={deleteHomeSectionAction} fields={{ id }} label="Delete section" title="Delete this section?" description="It will be removed from the homepage. You can add a new one later." confirmLabel="Delete" />}
      />
      <Panel>
        <HomeSectionForm
          choices={{ products, categories: categories.map((c) => ({ id: c.id, name: c.name, depth: c.depth })), collections }}
          initial={{
            id: section.id,
            type: section.type,
            title: section.title ?? "",
            subtitle: section.subtitle ?? "",
            body: section.body ?? "",
            ctaLabel: section.ctaLabel ?? "",
            ctaHref: section.ctaHref ?? "",
            secondaryCtaLabel: section.secondaryCtaLabel ?? "",
            secondaryCtaHref: section.secondaryCtaHref ?? "",
            imageId: section.imageId,
            imageUrl: section.image ? mediaUrl(base, section.image, 640) : null,
            isVisible: section.isVisible,
            startsAt: section.startsAt?.toISOString() ?? null,
            endsAt: section.endsAt?.toISOString() ?? null,
            config: (section.config ?? {}) as Record<string, unknown>,
            items: section.items.map((item) => ({ title: item.title ?? "", body: item.body ?? "", href: item.href ?? "", imageId: item.imageId, imageUrl: item.image ? mediaUrl(base, item.image, 320) : null })),
          }}
        />
      </Panel>
    </div>
  );
}
