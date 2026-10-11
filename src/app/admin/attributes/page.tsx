import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guards";
import { deleteTagAction, deleteTagGroupAction } from "@/server/actions/admin/catalog";
import { AdminPageHeader, Panel } from "@/components/admin/admin-ui";
import { TagForm, TagGroupDialog } from "@/components/admin/catalog-forms";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Filters & tags" };

export default async function AttributesPage() {
  await requireStaffPage("catalog:manage", "/admin/attributes");
  const groups = await prisma.tagGroup.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    include: { tags: { orderBy: [{ position: "asc" }, { name: "asc" }], include: { _count: { select: { products: true } } } } },
  });
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Filters & tags"
        description="Tags help customers browse by occasion, recipient, color and more. Groups marked as filters appear in the shop's filter panel and the gift finder (Occasion and Recipient)."
        actions={<TagGroupDialog initial={{}} trigger="Add filter group" />}
      />
      {groups.map((group) => (
        <Panel
          key={group.id}
          title={
            <span className="flex items-center gap-2">
              {group.name} {group.isFilterable ? <Badge tone="success">Filter</Badge> : <Badge>Hidden</Badge>}
            </span>
          }
          description={`?${group.slug}=…`}
          actions={
            <>
              <TagGroupDialog variant="ghost" trigger="Edit" initial={{ id: group.id, name: group.name, slug: group.slug, description: group.description, isFilterable: group.isFilterable }} />
              <ConfirmButton action={deleteTagGroupAction} fields={{ id: group.id }} variant="ghost" label="Delete" title={`Delete ${group.name}?`} description="All tags in this group are removed from products." confirmLabel="Delete group" />
            </>
          }
        >
          <ul className="mb-4 flex flex-wrap gap-2">
            {group.tags.map((tag) => (
              <li key={tag.id} className="inline-flex items-center gap-1 rounded-full bg-white py-1 pl-3 pr-1 text-sm ring-1 ring-line">
                {tag.name}
                <span className="text-xs text-ink-soft">({tag._count.products})</span>
                <form action={deleteTagAction}>
                  <input type="hidden" name="id" value={tag.id} />
                  <button type="submit" className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-ink-soft hover:bg-wine-soft hover:text-wine" aria-label={`Delete tag ${tag.name}`}>
                    ×
                  </button>
                </form>
              </li>
            ))}
            {group.tags.length === 0 ? <li className="text-sm text-ink-soft">No tags yet.</li> : null}
          </ul>
          <TagForm groupId={group.id} />
        </Panel>
      ))}
      {groups.length === 0 ? <p className="text-ink-soft">No filter groups yet.</p> : null}
    </div>
  );
}
