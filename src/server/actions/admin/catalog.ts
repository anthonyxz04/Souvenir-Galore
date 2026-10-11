"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { isValidSlug, slugify } from "@/lib/text";
import { checkbox, errorState, zodFieldErrors, type FormState } from "@/lib/validation/forms";
import { actorOf, AdminActionError, guarded, requirePermission } from "@/server/guard";

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

function slugOrFallback(slug: string | null, name: string): string {
  const value = (slug ?? "").trim().toLowerCase();
  if (value) {
    if (!isValidSlug(value)) throw new AdminActionError("The web address can only use lowercase letters, numbers and hyphens.");
    return value;
  }
  return slugify(name);
}

function refreshCatalog() {
  revalidatePath("/", "layout");
}

// ─────────────────────────────────────────────────────────────
// Categories
// ─────────────────────────────────────────────────────────────

const categorySchema = z.object({
  id: text(40),
  name: z.string().trim().min(1, "Enter a name.").max(80),
  slug: text(100),
  parentId: text(40),
  description: text(1000),
  imageId: text(40),
  seoTitle: text(70),
  seoDescription: text(170),
  isPublished: checkbox,
  showInNav: checkbox,
});

async function descendantIds(id: string): Promise<Set<string>> {
  const all = await prisma.category.findMany({ select: { id: true, parentId: true } });
  const result = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of all) if (c.parentId && result.has(c.parentId) && !result.has(c.id)) (result.add(c.id), (grew = true));
  }
  return result;
}

export async function saveCategoryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return guarded("catalog:manage", async (user) => {
    const parsed = categorySchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return errorState("Check the highlighted fields.", zodFieldErrors(parsed.error), formData);
    const data = parsed.data;
    const slug = slugOrFallback(data.slug, data.name);
    if (data.id && data.parentId && (await descendantIds(data.id)).has(data.parentId)) {
      throw new AdminActionError("A category can't be placed inside itself or one of its subcategories.");
    }
    const clash = await prisma.category.findUnique({ where: { slug }, select: { id: true } });
    if (clash && clash.id !== data.id) return errorState("Another category already uses this web address.", { slug: "Already in use." }, formData);
    const image = data.imageId ? await prisma.mediaAsset.findFirst({ where: { id: data.imageId, visibility: "PUBLIC" }, select: { id: true } }) : null;

    const values = {
      name: data.name,
      slug,
      parentId: data.parentId,
      description: data.description,
      imageId: image?.id ?? null,
      seoTitle: data.seoTitle,
      seoDescription: data.seoDescription,
      isPublished: data.isPublished,
      showInNav: data.showInNav,
    };
    if (data.id) {
      await prisma.category.update({ where: { id: data.id }, data: values });
    } else {
      const last = await prisma.category.aggregate({ where: { parentId: data.parentId }, _max: { position: true } });
      await prisma.category.create({ data: { ...values, position: (last._max.position ?? -1) + 1 } });
    }
    await logAudit({ actor: actorOf(user), action: data.id ? "category.update" : "category.create", entityType: "Category", entityId: data.id ?? undefined, summary: data.name });
    revalidatePath("/admin/categories");
    refreshCatalog();
    return { status: "success", message: data.id ? "Category saved." : "Category created." };
  });
}

export async function deleteCategoryAction(formData: FormData): Promise<void> {
  const user = await requirePermission("catalog:manage");
  const id = String(formData.get("id") ?? "");
  const category = await prisma.category.findUnique({ where: { id }, select: { name: true, _count: { select: { children: true } } } });
  if (!category) return;
  if (category._count.children > 0) {
    // Move subcategories up one level instead of orphaning them.
    const parent = await prisma.category.findUnique({ where: { id }, select: { parentId: true } });
    await prisma.category.updateMany({ where: { parentId: id }, data: { parentId: parent?.parentId ?? null } });
  }
  await prisma.category.delete({ where: { id } });
  await logAudit({ actor: actorOf(user), action: "category.delete", entityType: "Category", entityId: id, summary: category.name });
  revalidatePath("/admin/categories");
  refreshCatalog();
}

export async function moveCategoryAction(formData: FormData): Promise<void> {
  await requirePermission("catalog:manage");
  const id = String(formData.get("id") ?? "");
  const direction = formData.get("direction") === "up" ? -1 : 1;
  const category = await prisma.category.findUnique({ where: { id }, select: { parentId: true } });
  if (!category) return;
  const siblings = await prisma.category.findMany({ where: { parentId: category.parentId }, orderBy: [{ position: "asc" }, { name: "asc" }], select: { id: true } });
  await reorder(siblings.map((s) => s.id), id, direction, (sid, position) => prisma.category.update({ where: { id: sid }, data: { position } }));
  revalidatePath("/admin/categories");
  refreshCatalog();
}

async function reorder(ids: string[], id: string, direction: number, write: (id: string, position: number) => Promise<unknown>) {
  const index = ids.indexOf(id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= ids.length) return;
  const next = [...ids];
  [next[index], next[target]] = [next[target], next[index]];
  for (const [position, itemId] of next.entries()) await write(itemId, position);
}

// ─────────────────────────────────────────────────────────────
// Collections
// ─────────────────────────────────────────────────────────────

const collectionSchema = z.object({
  id: text(40),
  name: z.string().trim().min(1, "Enter a name.").max(100),
  slug: text(100),
  description: text(1000),
  kind: z.enum(["STANDARD", "SEASONAL", "OCCASION", "LIMITED"]),
  imageId: text(40),
  startsAt: text(40),
  endsAt: text(40),
  seoTitle: text(70),
  seoDescription: text(170),
  isPublished: checkbox,
  isFeatured: checkbox,
});

export async function saveCollectionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  let createdId: string | null = null;
  const result = await guarded("catalog:manage", async (user) => {
    const parsed = collectionSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return errorState("Check the highlighted fields.", zodFieldErrors(parsed.error), formData);
    const data = parsed.data;
    const slug = slugOrFallback(data.slug, data.name);
    const clash = await prisma.collection.findUnique({ where: { slug }, select: { id: true } });
    if (clash && clash.id !== data.id) return errorState("Another collection already uses this web address.", { slug: "Already in use." }, formData);
    const asDate = (value: string | null, endOfDay: boolean) =>
      value ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T${endOfDay ? "23:59:59" : "00:00:00"}Z` : value) : null;
    const startsAt = asDate(data.startsAt, false);
    const endsAt = asDate(data.endsAt, true);
    if ((startsAt && Number.isNaN(startsAt.getTime())) || (endsAt && Number.isNaN(endsAt.getTime()))) throw new AdminActionError("Enter valid dates.");
    if (startsAt && endsAt && endsAt <= startsAt) return errorState("The end date must be after the start date.", { endsAt: "Must be after the start." }, formData);
    const image = data.imageId ? await prisma.mediaAsset.findFirst({ where: { id: data.imageId, visibility: "PUBLIC" }, select: { id: true } }) : null;
    const values = {
      name: data.name,
      slug,
      description: data.description,
      kind: data.kind,
      imageId: image?.id ?? null,
      startsAt,
      endsAt,
      seoTitle: data.seoTitle,
      seoDescription: data.seoDescription,
      isPublished: data.isPublished,
      isFeatured: data.isFeatured,
    };
    if (data.id) {
      await prisma.collection.update({ where: { id: data.id }, data: values });
    } else {
      const last = await prisma.collection.aggregate({ _max: { position: true } });
      const created = await prisma.collection.create({ data: { ...values, position: (last._max.position ?? -1) + 1 } });
      createdId = created.id;
    }
    await logAudit({ actor: actorOf(user), action: data.id ? "collection.update" : "collection.create", entityType: "Collection", entityId: data.id ?? createdId ?? undefined, summary: data.name });
    revalidatePath("/admin/collections");
    refreshCatalog();
    return { status: "success", message: "Collection saved." };
  });
  if (createdId) redirect(`/admin/collections/${createdId}`);
  return result;
}

export async function deleteCollectionAction(formData: FormData): Promise<void> {
  const user = await requirePermission("catalog:manage");
  const id = String(formData.get("id") ?? "");
  const collection = await prisma.collection.findUnique({ where: { id }, select: { name: true } });
  if (!collection) redirect("/admin/collections");
  await prisma.collection.delete({ where: { id } });
  await logAudit({ actor: actorOf(user), action: "collection.delete", entityType: "Collection", entityId: id, summary: collection.name });
  refreshCatalog();
  redirect("/admin/collections");
}

export async function moveCollectionAction(formData: FormData): Promise<void> {
  await requirePermission("catalog:manage");
  const id = String(formData.get("id") ?? "");
  const direction = formData.get("direction") === "up" ? -1 : 1;
  const all = await prisma.collection.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }], select: { id: true } });
  await reorder(all.map((c) => c.id), id, direction, (cid, position) => prisma.collection.update({ where: { id: cid }, data: { position } }));
  revalidatePath("/admin/collections");
  refreshCatalog();
}

export async function addProductToCollectionAction(formData: FormData): Promise<void> {
  await requirePermission("catalog:manage");
  const collectionId = String(formData.get("collectionId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  if (!collectionId || !productId) return;
  const exists = await prisma.collectionProduct.findUnique({ where: { collectionId_productId: { collectionId, productId } } });
  if (!exists) {
    const last = await prisma.collectionProduct.aggregate({ where: { collectionId }, _max: { position: true } });
    await prisma.collectionProduct.create({ data: { collectionId, productId, position: (last._max.position ?? -1) + 1 } });
  }
  revalidatePath(`/admin/collections/${collectionId}`);
  refreshCatalog();
}

export async function removeProductFromCollectionAction(formData: FormData): Promise<void> {
  await requirePermission("catalog:manage");
  const collectionId = String(formData.get("collectionId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  await prisma.collectionProduct.deleteMany({ where: { collectionId, productId } });
  revalidatePath(`/admin/collections/${collectionId}`);
  refreshCatalog();
}

export async function moveCollectionProductAction(formData: FormData): Promise<void> {
  await requirePermission("catalog:manage");
  const collectionId = String(formData.get("collectionId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  const direction = formData.get("direction") === "up" ? -1 : 1;
  const items = await prisma.collectionProduct.findMany({ where: { collectionId }, orderBy: { position: "asc" }, select: { productId: true } });
  await reorder(items.map((i) => i.productId), productId, direction, (pid, position) =>
    prisma.collectionProduct.update({ where: { collectionId_productId: { collectionId, productId: pid } }, data: { position } }),
  );
  revalidatePath(`/admin/collections/${collectionId}`);
}

// ─────────────────────────────────────────────────────────────
// Filter groups & tags (Occasion, Recipient, Color…)
// ─────────────────────────────────────────────────────────────

export async function saveTagGroupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return guarded("catalog:manage", async (user) => {
    const parsed = z
      .object({ id: text(40), name: z.string().trim().min(1, "Enter a name.").max(60), slug: text(60), description: text(300), isFilterable: checkbox })
      .safeParse(Object.fromEntries(formData));
    if (!parsed.success) return errorState("Check the highlighted fields.", zodFieldErrors(parsed.error), formData);
    const data = parsed.data;
    const slug = slugOrFallback(data.slug, data.name);
    if (["q", "sort", "page", "min", "max", "availability", "sale", "personalizable"].includes(slug)) {
      return errorState("This web name is reserved. Choose another.", { slug: "Reserved name." }, formData);
    }
    const clash = await prisma.tagGroup.findUnique({ where: { slug }, select: { id: true } });
    if (clash && clash.id !== data.id) return errorState("Another group already uses this name.", { slug: "Already in use." }, formData);
    if (data.id) await prisma.tagGroup.update({ where: { id: data.id }, data: { name: data.name, slug, description: data.description, isFilterable: data.isFilterable } });
    else {
      const last = await prisma.tagGroup.aggregate({ _max: { position: true } });
      await prisma.tagGroup.create({ data: { name: data.name, slug, description: data.description, isFilterable: data.isFilterable, position: (last._max.position ?? -1) + 1 } });
    }
    await logAudit({ actor: actorOf(user), action: "taggroup.save", entityType: "TagGroup", entityId: data.id ?? undefined, summary: data.name });
    revalidatePath("/admin/attributes");
    refreshCatalog();
    return { status: "success", message: "Saved." };
  });
}

export async function deleteTagGroupAction(formData: FormData): Promise<void> {
  const user = await requirePermission("catalog:manage");
  const id = String(formData.get("id") ?? "");
  const group = await prisma.tagGroup.delete({ where: { id } }).catch(() => null);
  if (group) await logAudit({ actor: actorOf(user), action: "taggroup.delete", entityType: "TagGroup", entityId: id, summary: group.name });
  revalidatePath("/admin/attributes");
  refreshCatalog();
}

export async function saveTagAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return guarded("catalog:manage", async () => {
    const parsed = z.object({ id: text(40), groupId: z.string().min(1).max(40), name: z.string().trim().min(1, "Enter a name.").max(60) }).safeParse(Object.fromEntries(formData));
    if (!parsed.success) return errorState("Check the highlighted fields.", zodFieldErrors(parsed.error), formData);
    const { id, groupId, name } = parsed.data;
    const slug = slugify(name, 60);
    const clash = await prisma.tag.findUnique({ where: { groupId_slug: { groupId, slug } }, select: { id: true } });
    if (clash && clash.id !== id) return errorState("This group already has a tag with that name.", { name: "Already exists." }, formData);
    if (id) await prisma.tag.update({ where: { id }, data: { name, slug } });
    else {
      const last = await prisma.tag.aggregate({ where: { groupId }, _max: { position: true } });
      await prisma.tag.create({ data: { groupId, name, slug, position: (last._max.position ?? -1) + 1 } });
    }
    revalidatePath("/admin/attributes");
    refreshCatalog();
    return { status: "success", message: id ? "Tag renamed." : "Tag added." };
  });
}

export async function deleteTagAction(formData: FormData): Promise<void> {
  await requirePermission("catalog:manage");
  await prisma.tag.deleteMany({ where: { id: String(formData.get("id") ?? "") } });
  revalidatePath("/admin/attributes");
  refreshCatalog();
}
