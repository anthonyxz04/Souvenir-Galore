import { prisma } from "../db";

/** Categories flattened into tree order with a depth, for pickers and admin lists. */
export async function categoryTree() {
  const categories = await prisma.category.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, parentId: true, isPublished: true, showInNav: true, position: true, description: true, imageId: true, _count: { select: { products: true, children: true } } },
  });
  const byParent = new Map<string | null, typeof categories>();
  for (const category of categories) {
    const key = category.parentId ?? null;
    byParent.set(key, [...(byParent.get(key) ?? []), category]);
  }
  const result: ((typeof categories)[number] & { depth: number })[] = [];
  const visit = (parentId: string | null, depth: number, seen: Set<string>) => {
    for (const category of byParent.get(parentId) ?? []) {
      if (seen.has(category.id)) continue;
      seen.add(category.id);
      result.push({ ...category, depth });
      visit(category.id, depth + 1, seen);
    }
  };
  visit(null, 0, new Set());
  // Orphans (parent deleted) still appear at the top level.
  for (const category of categories) if (!result.some((c) => c.id === category.id)) result.push({ ...category, depth: 0 });
  return result;
}

export async function productEditorChoices() {
  const [categories, collections, tagGroups] = await Promise.all([
    categoryTree(),
    prisma.collection.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    prisma.tagGroup.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }], select: { id: true, name: true, tags: { orderBy: [{ position: "asc" }, { name: "asc" }], select: { id: true, name: true } } } }),
  ]);
  return { categories: categories.map((c) => ({ id: c.id, name: c.name, depth: c.depth })), collections, tagGroups };
}
