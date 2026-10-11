"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { PAYMENT_METHOD_TYPES } from "@/lib/domain";
import { parseMoney } from "@/lib/money";
import { registeredProviderKeys } from "@/lib/payments/providers";
import { missingRequirements, PAYMENT_TYPE_INFO, sanitizeConfig } from "@/lib/payments/rules";
import { slugify } from "@/lib/text";
import { getSettings } from "@/lib/settings";
import { checkbox, errorState, zodFieldErrors, type FormState } from "@/lib/validation/forms";
import { actorOf, AdminActionError, guarded, requirePermission } from "@/server/guard";

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

const methodSchema = z.object({
  id: text(40),
  type: z.enum(PAYMENT_METHOD_TYPES),
  name: z.string().trim().min(1, "Enter the name customers will see.").max(60),
  description: text(300),
  instructions: text(2000),
  isEnabled: checkbox,
  requiresManualVerification: checkbox,
  allowCustomerReference: checkbox,
  availableForDelivery: checkbox,
  availableForPickup: checkbox,
  minOrderTotal: text(20),
  maxOrderTotal: text(20),
  provider: text(60),
});

export async function savePaymentMethodAction(_prev: FormState, formData: FormData): Promise<FormState> {
  let createdId: string | null = null;
  const result = await guarded("payment-methods:manage", async (user) => {
    const parsed = methodSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return errorState("Check the highlighted fields.", zodFieldErrors(parsed.error), formData);
    const data = parsed.data;
    const existing = data.id ? await prisma.paymentMethod.findUnique({ where: { id: data.id } }) : null;
    if (data.id && !existing) throw new AdminActionError("This payment method no longer exists.");
    if (existing && existing.type !== data.type) throw new AdminActionError("A payment method's type can't be changed. Create a new method instead.");

    const configInput: Record<string, unknown> = {};
    for (const field of PAYMENT_TYPE_INFO[data.type].configFields) configInput[field.key] = formData.get(`config.${field.key}`);
    const config = sanitizeConfig(data.type, configInput);

    const decimals = (await getSettings("commerce")).currencyDecimals;
    const minOrderTotal = data.minOrderTotal ? parseMoney(data.minOrderTotal, decimals) : null;
    const maxOrderTotal = data.maxOrderTotal ? parseMoney(data.maxOrderTotal, decimals) : null;
    if (data.minOrderTotal && minOrderTotal === null) return errorState("Enter a valid minimum.", { minOrderTotal: "Enter an amount like 10.00." }, formData);
    if (data.maxOrderTotal && maxOrderTotal === null) return errorState("Enter a valid maximum.", { maxOrderTotal: "Enter an amount like 500.00." }, formData);
    if (!data.availableForDelivery && !data.availableForPickup) return errorState("Allow this method for delivery, pickup or both.");

    // Enabling is refused until every required detail is present.
    const missing = missingRequirements({ type: data.type, name: data.name, instructions: data.instructions, config, provider: data.provider }, registeredProviderKeys());
    if (data.isEnabled && missing.length) {
      return errorState(`This method can't be turned on yet. Missing: ${missing.join(", ")}.`, { isEnabled: "Complete the required details first." }, formData);
    }

    const values = {
      type: data.type,
      name: data.name,
      description: data.description,
      instructions: data.instructions,
      isEnabled: data.isEnabled,
      requiresManualVerification: data.type === "ONLINE_GATEWAY" ? data.requiresManualVerification : true,
      allowCustomerReference: data.type === "CASH_ON_DELIVERY" ? false : data.allowCustomerReference,
      availableForDelivery: data.availableForDelivery,
      availableForPickup: data.availableForPickup,
      minOrderTotal,
      maxOrderTotal,
      provider: data.type === "ONLINE_GATEWAY" ? data.provider : null,
      config,
    };
    let id = existing?.id;
    if (existing) {
      await prisma.paymentMethod.update({ where: { id: existing.id }, data: values });
    } else {
      let code = slugify(data.name, 40);
      if (await prisma.paymentMethod.findUnique({ where: { code } })) code = `${code}-${Date.now().toString(36)}`;
      const last = await prisma.paymentMethod.aggregate({ _max: { position: true } });
      const created = await prisma.paymentMethod.create({ data: { ...values, code, position: (last._max.position ?? -1) + 1 } });
      id = created.id;
      createdId = created.id;
    }
    await logAudit({
      actor: actorOf(user),
      action: existing ? "payment_method.update" : "payment_method.create",
      entityType: "PaymentMethod",
      entityId: id,
      summary: `${data.name}: ${data.isEnabled ? "enabled" : "disabled"}`,
      metadata: { type: data.type, isEnabled: data.isEnabled, wasEnabled: existing?.isEnabled ?? false },
    });
    revalidatePath("/admin/payments");
    revalidatePath("/checkout");
    return { status: "success", message: data.isEnabled ? "Saved. Customers can now choose this method at checkout." : "Saved. This method is turned off." };
  });
  if (createdId) redirect(`/admin/payments/${createdId}?created=1`);
  return result;
}

export async function setPaymentMethodEnabledAction(formData: FormData): Promise<void> {
  const user = await requirePermission("payment-methods:manage");
  const id = String(formData.get("id") ?? "");
  const enable = formData.get("enable") === "true";
  const method = await prisma.paymentMethod.findUnique({ where: { id } });
  if (!method) return;
  if (enable) {
    const missing = missingRequirements({ ...method, config: (method.config ?? {}) as Record<string, unknown> }, registeredProviderKeys());
    if (missing.length) redirect(`/admin/payments/${id}?missing=1`);
  }
  await prisma.paymentMethod.update({ where: { id }, data: { isEnabled: enable } });
  await logAudit({ actor: actorOf(user), action: enable ? "payment_method.enable" : "payment_method.disable", entityType: "PaymentMethod", entityId: id, summary: method.name });
  revalidatePath("/admin/payments");
  revalidatePath("/checkout");
}

export async function movePaymentMethodAction(formData: FormData): Promise<void> {
  await requirePermission("payment-methods:manage");
  const id = String(formData.get("id") ?? "");
  const direction = formData.get("direction") === "up" ? -1 : 1;
  const all = await prisma.paymentMethod.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }], select: { id: true } });
  const ids = all.map((m) => m.id);
  const index = ids.indexOf(id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= ids.length) return;
  [ids[index], ids[target]] = [ids[target], ids[index]];
  for (const [position, methodId] of ids.entries()) await prisma.paymentMethod.update({ where: { id: methodId }, data: { position } });
  revalidatePath("/admin/payments");
}

export async function deletePaymentMethodAction(formData: FormData): Promise<void> {
  const user = await requirePermission("payment-methods:manage");
  const id = String(formData.get("id") ?? "");
  const method = await prisma.paymentMethod.findUnique({ where: { id }, select: { name: true, _count: { select: { orders: true } } } });
  if (!method) redirect("/admin/payments");
  if (method._count.orders > 0) await prisma.paymentMethod.update({ where: { id }, data: { isEnabled: false } });
  else await prisma.paymentMethod.delete({ where: { id } });
  await logAudit({ actor: actorOf(user), action: "payment_method.delete", entityType: "PaymentMethod", entityId: id, summary: method.name });
  revalidatePath("/admin/payments");
  redirect("/admin/payments");
}
