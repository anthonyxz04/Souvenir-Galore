"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { duplicateProduct, productPayloadSchema, ProductValidationError, saveProduct } from "@/lib/catalog/product-admin";
import { adjustStock } from "@/lib/orders/service";
import { getSettings } from "@/lib/settings";
import { errorState, zodFieldErrors, type FormState } from "@/lib/validation/forms";
import { actorOf, AdminActionError, guarded, requirePermission } from "@/server/guard";

function refreshCatalog(slug?: string) {
  revalidatePath("/admin/products");
  revalidatePath("/shop");
  revalidatePath("/");
  if (slug) revalidatePath(`/products/${slug}`);
}

export async function saveProductAction(_prev: FormState, formData: FormData): Promise<FormState> {
  let createdId: string | null = null;
  const result = await guarded("products:manage", async (user) => {
    let raw: unknown;
    try {
      raw = JSON.parse(String(formData.get("payload") ?? ""));
    } catch {
      throw new AdminActionError("The form data couldn't be read. Reload the page and try again.");
    }
    const parsed = productPayloadSchema.safeParse(raw);
    if (!parsed.success) return errorState("Check the highlighted fields.", zodFieldErrors(parsed.error));
    const commerce = await getSettings("commerce");
    try {
      const saved = await saveProduct(parsed.data, commerce.currencyDecimals, user.id);
      await logAudit({
        actor: actorOf(user),
        action: saved.created ? "product.create" : "product.update",
        entityType: "Product",
        entityId: saved.id,
        summary: `${parsed.data.name} (${parsed.data.status.toLowerCase()})`,
      });
      refreshCatalog(saved.slug);
      revalidatePath(`/admin/products/${saved.id}`);
      if (saved.created) createdId = saved.id;
      return { status: "success", message: "Product saved.", data: { id: saved.id, slug: saved.slug } };
    } catch (error) {
      if (error instanceof ProductValidationError) return errorState(error.message, error.fieldErrors);
      throw error;
    }
  });
  if (createdId) redirect(`/admin/products/${createdId}?created=1`);
  return result;
}

export async function duplicateProductAction(formData: FormData): Promise<void> {
  const user = await requirePermission("products:manage");
  const productId = String(formData.get("productId") ?? "");
  const copy = await duplicateProduct(productId);
  await logAudit({ actor: actorOf(user), action: "product.duplicate", entityType: "Product", entityId: copy.id, summary: `Copied from ${productId}` });
  revalidatePath("/admin/products");
  redirect(`/admin/products/${copy.id}?duplicated=1`);
}

export async function setProductStatusAction(formData: FormData): Promise<void> {
  const user = await requirePermission("products:manage");
  const productId = String(formData.get("productId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!["DRAFT", "ACTIVE", "ARCHIVED"].includes(status)) return;
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { slug: true, name: true, publishedAt: true } });
  if (!product) return;
  await prisma.product.update({
    where: { id: productId },
    data: { status: status as "DRAFT" | "ACTIVE" | "ARCHIVED", ...(status === "ACTIVE" && !product.publishedAt ? { publishedAt: new Date() } : {}) },
  });
  await logAudit({ actor: actorOf(user), action: "product.status", entityType: "Product", entityId: productId, summary: `${product.name} → ${status}` });
  refreshCatalog(product.slug);
  revalidatePath(`/admin/products/${productId}`);
}

/** Deletes a product only if it was never ordered; otherwise it must be archived to keep order history intact. */
export async function deleteProductAction(formData: FormData): Promise<void> {
  const user = await requirePermission("products:manage");
  const productId = String(formData.get("productId") ?? "");
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { name: true, slug: true, _count: { select: { orderItems: true } } } });
  if (!product) redirect("/admin/products");
  if (product._count.orderItems > 0) {
    await prisma.product.update({ where: { id: productId }, data: { status: "ARCHIVED" } });
    await logAudit({ actor: actorOf(user), action: "product.archive", entityType: "Product", entityId: productId, summary: `${product.name} archived (has orders)` });
  } else {
    await prisma.product.delete({ where: { id: productId } });
    await logAudit({ actor: actorOf(user), action: "product.delete", entityType: "Product", entityId: productId, summary: product.name });
  }
  refreshCatalog(product.slug);
  redirect("/admin/products");
}

export async function adjustStockAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return guarded("products:manage", async (user) => {
    const variantId = String(formData.get("variantId") ?? "");
    const delta = Number(formData.get("delta"));
    const reason = String(formData.get("reason") ?? "MANUAL_ADJUSTMENT");
    const note = String(formData.get("note") ?? "").slice(0, 300);
    if (!Number.isInteger(delta) || delta === 0) throw new AdminActionError("Enter a whole number, e.g. 5 to add or -2 to remove.");
    const variant = await adjustStock(variantId, delta, actorOf(user), note, reason === "RESTOCK" ? "RESTOCK" : reason === "RETURN" ? "RETURN" : "MANUAL_ADJUSTMENT");
    revalidatePath("/admin/inventory");
    revalidatePath(`/admin/products/${variant.productId}`);
    return { status: "success", message: `Stock is now ${variant.stock}.` };
  });
}

// ── Sample catalog (dashboard buttons) ────────────────────────

/** Adds one sample product. Called once per product by the dashboard so each request stays short. */
export async function addDemoProductAction(index: number): Promise<FormState> {
  return guarded("products:manage", async (user) => {
    const { addDemoProduct, DEMO_PRODUCT_COUNT } = await import("@/lib/demo-catalog");
    if (!Number.isInteger(index) || index < 0 || index >= DEMO_PRODUCT_COUNT) throw new AdminActionError("Unknown sample product.");
    if ((await prisma.category.count()) === 0) throw new AdminActionError("The starting categories are missing. Redeploy the site so the starting data is loaded.");
    const result = await addDemoProduct(index, user.id);
    if (index === DEMO_PRODUCT_COUNT - 1) {
      await logAudit({ actor: actorOf(user), action: "demo.add", summary: "Sample products added" });
      refreshCatalog();
    }
    return { status: "success", message: result.created ? `Added ${result.name}.` : `${result.name} was already there.` };
  });
}

export async function removeDemoCatalogAction(): Promise<void> {
  const user = await requirePermission("products:manage");
  const { removeDemoCatalog } = await import("@/lib/demo-catalog");
  const { deleted, archived } = await removeDemoCatalog();
  await logAudit({ actor: actorOf(user), action: "demo.remove", summary: `Sample products removed: ${deleted} deleted, ${archived} archived` });
  refreshCatalog();
  revalidatePath("/admin");
}
