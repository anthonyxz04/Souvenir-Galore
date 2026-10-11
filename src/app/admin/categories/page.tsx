import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guards";
import { categoryTree } from "@/lib/catalog/admin-choices";
import { publicMediaBase } from "@/lib/storage";
import { mediaUrl } from "@/lib/storage/urls";
import { deleteCategoryAction, moveCategoryAction } from "@/server/actions/admin/catalog";
import { AdminPageHeader, EmptyRow, Table, Td, Th } from "@/components/admin/admin-ui";
import { CategoryDialog } from "@/components/admin/catalog-forms";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { Badge } from "@/components/ui/badge";
import { ArrowDownIcon, ArrowUpIcon } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  await requireStaffPage("catalog:manage", "/admin/categories");
  const tree = await categoryTree();
  const images = await prisma.mediaAsset.findMany({ where: { id: { in: tree.map((c) => c.imageId).filter(Boolean) as string[] } }, select: { id: true, key: true, renditions: true } });
  const base = publicMediaBase();
  const imageUrl = (id: string | null) => {
    const image = images.find((i) => i.id === id);
    return image ? mediaUrl(base, image, 320) : null;
  };
  const parents = tree.map((c) => ({ id: c.id, name: c.name, depth: c.depth }));

  return (
    <div>
      <AdminPageHeader
        title="Categories"
        description="Organize products into categories and subcategories. A product can belong to several. Use the arrows to change the order in menus."
        actions={<CategoryDialog initial={{}} parents={parents} trigger="Add category" />}
      />
      <Table>
        <thead>
          <tr>
            <Th>Category</Th>
            <Th>Products</Th>
            <Th>Visibility</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {tree.length ? (
            tree.map((category) => (
              <tr key={category.id}>
                <Td>
                  <div className="flex items-center gap-3" style={{ paddingLeft: `${category.depth * 1.5}rem` }}>
                    {category.depth > 0 ? <span className="text-ink-soft" aria-hidden>↳</span> : null}
                    <span>
                      <span className="block font-medium">{category.name}</span>
                      <span className="text-xs text-ink-soft">/category/{category.slug}</span>
                    </span>
                  </div>
                </Td>
                <Td className="tabular-nums">{category._count.products}</Td>
                <Td className="space-x-1">
                  <Badge tone={category.isPublished ? "success" : "neutral"}>{category.isPublished ? "Visible" : "Hidden"}</Badge>
                  {category.isPublished && !category.showInNav ? <Badge>Not in menu</Badge> : null}
                </Td>
                <Td>
                  <div className="flex items-center justify-end gap-1">
                    <form action={moveCategoryAction}>
                      <input type="hidden" name="id" value={category.id} />
                      <input type="hidden" name="direction" value="up" />
                      <button type="submit" className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-ink/5" aria-label={`Move ${category.name} up`}>
                        <ArrowUpIcon size={16} />
                      </button>
                    </form>
                    <form action={moveCategoryAction}>
                      <input type="hidden" name="id" value={category.id} />
                      <input type="hidden" name="direction" value="down" />
                      <button type="submit" className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-ink/5" aria-label={`Move ${category.name} down`}>
                        <ArrowDownIcon size={16} />
                      </button>
                    </form>
                    <CategoryDialog
                      variant="ghost"
                      trigger="Edit"
                      parents={parents}
                      initial={{
                        id: category.id,
                        name: category.name,
                        slug: category.slug,
                        parentId: category.parentId,
                        description: category.description,
                        imageId: category.imageId,
                        imageUrl: imageUrl(category.imageId),
                        isPublished: category.isPublished,
                        showInNav: category.showInNav,
                      }}
                    />
                    <ConfirmButton
                      action={deleteCategoryAction}
                      fields={{ id: category.id }}
                      variant="ghost"
                      label="Delete"
                      title={`Delete ${category.name}?`}
                      description={`Products stay in the store but are removed from this category.${category._count.children ? " Its subcategories move up one level." : ""}`}
                      confirmLabel="Delete category"
                    />
                  </div>
                </Td>
              </tr>
            ))
          ) : (
            <EmptyRow colSpan={4}>No categories yet.</EmptyRow>
          )}
        </tbody>
      </Table>
      <p className="mt-4 text-sm text-ink-soft">
        Tip: category pages live at <Link href="/shop" className="underline">/category/web-address</Link> and appear in the sitemap automatically.
      </p>
    </div>
  );
}
