"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { parseMoney } from "@/lib/money";
import { instagramUsername, whatsappNumber } from "@/lib/text";
import { getAllSettings, saveSettings } from "@/lib/settings";
import type { SettingsKey } from "@/lib/settings/schemas";
import { checkbox, errorState, zodFieldErrors, type FormState } from "@/lib/validation/forms";
import { actorOf, guarded, requirePermission } from "@/server/guard";

const on = (formData: FormData, name: string) => formData.get(name) === "on";
const str = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

/** Turn the submitted form for one settings group into the stored shape. */
async function buildSettings(group: SettingsKey, formData: FormData): Promise<{ value: Record<string, unknown>; errors: Record<string, string> }> {
  const errors: Record<string, string> = {};
  const current = await getAllSettings();
  switch (group) {
    case "store":
      return {
        value: { name: str(formData, "name"), tagline: str(formData, "tagline"), description: str(formData, "description"), logoAssetId: str(formData, "logoAssetId") || null },
        errors,
      };
    case "contact":
      return {
        value: {
          email: str(formData, "email"),
          phone: str(formData, "phone"),
          whatsapp: whatsappNumber(str(formData, "whatsapp")),
          instagram: instagramUsername(str(formData, "instagram")),
          facebookUrl: str(formData, "facebookUrl"),
          tiktokUrl: str(formData, "tiktokUrl"),
          address: str(formData, "address"),
          hours: str(formData, "hours"),
          showWhatsappButton: on(formData, "showWhatsappButton"),
          showInstagramButton: on(formData, "showInstagramButton"),
          showEmailButton: on(formData, "showEmailButton"),
        },
        errors,
      };
    case "commerce": {
      const decimals = Number(str(formData, "currencyDecimals"));
      const currencyCode = str(formData, "currencyCode").toUpperCase();
      if ((decimals !== current.commerce.currencyDecimals || currencyCode !== current.commerce.currencyCode) && (await prisma.product.count()) > 0) {
        errors.currencyCode = "The store currency can't change after products exist, because every price would change meaning. Contact your developer to migrate prices.";
      }
      const taxPercent = Number(str(formData, "taxRatePercent") || "0");
      if (!Number.isFinite(taxPercent) || taxPercent < 0 || taxPercent > 50) errors.taxRatePercent = "Enter a rate between 0 and 50.";
      const minOrder = str(formData, "minOrderSubtotal") ? parseMoney(str(formData, "minOrderSubtotal"), decimals) : 0;
      if (minOrder === null) errors.minOrderSubtotal = "Enter an amount like 20.00, or leave empty.";
      const tiers = str(formData, "budgetTiers")
        .split(",")
        .map((t) => Number(t.trim()))
        .filter((n) => Number.isInteger(n) && n > 0);
      return {
        value: {
          currencyCode,
          currencyDecimals: decimals,
          currencyLocale: str(formData, "currencyLocale") || "en-US",
          secondaryCurrencyEnabled: on(formData, "secondaryCurrencyEnabled"),
          secondaryCurrencyCode: (str(formData, "secondaryCurrencyCode") || "LBP").toUpperCase(),
          secondaryCurrencyDecimals: Number(str(formData, "secondaryCurrencyDecimals") || "0"),
          secondaryCurrencyRate: Number(str(formData, "secondaryCurrencyRate") || "1"),
          taxEnabled: on(formData, "taxEnabled"),
          taxLabel: str(formData, "taxLabel") || "VAT",
          taxRateBps: Math.round(taxPercent * 100),
          taxIncluded: on(formData, "taxIncluded"),
          minOrderSubtotal: minOrder ?? 0,
          allowGuestCheckout: on(formData, "allowGuestCheckout"),
          maxQuantityPerLine: Number(str(formData, "maxQuantityPerLine") || "50"),
          lowStockThreshold: Number(str(formData, "lowStockThreshold") || "3"),
          newBadgeDays: Number(str(formData, "newBadgeDays") || "30"),
          reviewsEnabled: on(formData, "reviewsEnabled"),
          customOrdersEnabled: on(formData, "customOrdersEnabled"),
          customOrderUploadsEnabled: on(formData, "customOrderUploadsEnabled"),
          requireTermsAcceptance: on(formData, "requireTermsAcceptance"),
          budgetTiers: [...new Set(tiers)].sort((a, b) => a - b).slice(0, 5),
        },
        errors,
      };
    }
    case "pickup":
      return {
        value: { enabled: on(formData, "enabled"), locationName: str(formData, "locationName"), address: str(formData, "address"), hours: str(formData, "hours"), instructions: str(formData, "instructions") },
        errors,
      };
    case "announcement":
      return { value: { enabled: on(formData, "enabled"), message: str(formData, "message"), href: str(formData, "href") }, errors };
    case "newsletter":
      return {
        value: { enabled: on(formData, "enabled"), doubleOptIn: on(formData, "doubleOptIn"), heading: str(formData, "heading"), body: str(formData, "body"), consentText: str(formData, "consentText") },
        errors,
      };
    case "seo":
      return { value: { defaultTitle: str(formData, "defaultTitle"), defaultDescription: str(formData, "defaultDescription"), ogImageAssetId: str(formData, "ogImageAssetId") || null }, errors };
  }
}

const PERMISSION_FOR_GROUP: Record<SettingsKey, "settings:manage" | "content:manage" | "newsletter:manage"> = {
  store: "settings:manage",
  contact: "settings:manage",
  commerce: "settings:manage",
  pickup: "settings:manage",
  announcement: "content:manage",
  newsletter: "newsletter:manage",
  seo: "settings:manage",
};

export async function saveSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const group = String(formData.get("group") ?? "") as SettingsKey;
  if (!(group in PERMISSION_FOR_GROUP)) return errorState("Unknown settings section.");
  return guarded(PERMISSION_FOR_GROUP[group], async (user) => {
    const { value, errors } = await buildSettings(group, formData);
    if (Object.keys(errors).length) return errorState("Check the highlighted fields.", errors, formData);
    if (group === "store" && value.logoAssetId) {
      const logo = await prisma.mediaAsset.findFirst({ where: { id: String(value.logoAssetId), visibility: "PUBLIC" }, select: { id: true } });
      if (!logo) value.logoAssetId = null;
    }
    const result = await saveSettings(group, value, user.id);
    if (!result.ok) return errorState("Check the highlighted fields.", result.errors, formData);
    await logAudit({ actor: actorOf(user), action: `settings.${group}`, entityType: "Setting", entityId: group, summary: `Updated ${group} settings`, metadata: result.value });
    revalidatePath("/", "layout");
    return { status: "success", message: "Settings saved." };
  });
}

// ─────────────────────────────────────────────────────────────
// Delivery zones
// ─────────────────────────────────────────────────────────────

const zoneSchema = z.object({
  id: z.string().max(40).optional().transform((v) => v || undefined),
  name: z.string().trim().min(1, "Enter the area name.").max(80),
  description: z.string().trim().max(300).optional().transform((v) => v || null),
  fee: z.string().trim().max(20),
  freeAboveSubtotal: z.string().trim().max(20).optional(),
  minDays: z.string().trim().max(4).optional(),
  maxDays: z.string().trim().max(4).optional(),
  isActive: checkbox,
});

export async function saveDeliveryZoneAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return guarded("settings:manage", async (user) => {
    const parsed = zoneSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return errorState("Check the highlighted fields.", zodFieldErrors(parsed.error), formData);
    const data = parsed.data;
    const decimals = (await getAllSettings()).commerce.currencyDecimals;
    const errors: Record<string, string> = {};
    const fee = parseMoney(data.fee || "0", decimals);
    if (fee === null) errors.fee = "Enter the fee like 3.00 (0 for free).";
    const freeAbove = data.freeAboveSubtotal ? parseMoney(data.freeAboveSubtotal, decimals) : null;
    if (data.freeAboveSubtotal && freeAbove === null) errors.freeAboveSubtotal = "Enter an amount like 50.00, or leave empty.";
    const intOrNull = (value: string | undefined, field: string) => {
      if (!value) return null;
      const n = Number(value);
      if (!Number.isInteger(n) || n < 0 || n > 90) errors[field] = "Enter a number of days.";
      return n;
    };
    const minDays = intOrNull(data.minDays, "minDays");
    const maxDays = intOrNull(data.maxDays, "maxDays");
    if (minDays !== null && maxDays !== null && maxDays < minDays) errors.maxDays = "Must be at least the minimum.";
    if (Object.keys(errors).length) return errorState("Check the highlighted fields.", errors, formData);
    const values = { name: data.name, description: data.description, fee: fee!, freeAboveSubtotal: freeAbove, minDays, maxDays, isActive: data.isActive };
    if (data.id) await prisma.deliveryZone.update({ where: { id: data.id }, data: values });
    else {
      const last = await prisma.deliveryZone.aggregate({ _max: { position: true } });
      await prisma.deliveryZone.create({ data: { ...values, position: (last._max.position ?? -1) + 1 } });
    }
    await logAudit({ actor: actorOf(user), action: "delivery_zone.save", entityType: "DeliveryZone", entityId: data.id, summary: `${data.name}: ${data.isActive ? "active" : "inactive"}` });
    revalidatePath("/admin/delivery");
    revalidatePath("/checkout");
    return { status: "success", message: "Delivery area saved." };
  });
}

export async function deleteDeliveryZoneAction(formData: FormData): Promise<void> {
  const user = await requirePermission("settings:manage");
  const id = String(formData.get("id") ?? "");
  const zone = await prisma.deliveryZone.findUnique({ where: { id }, select: { name: true } });
  if (!zone) return;
  await prisma.deliveryZone.delete({ where: { id } });
  await logAudit({ actor: actorOf(user), action: "delivery_zone.delete", entityType: "DeliveryZone", entityId: id, summary: zone.name });
  revalidatePath("/admin/delivery");
}

export async function moveDeliveryZoneAction(formData: FormData): Promise<void> {
  await requirePermission("settings:manage");
  const id = String(formData.get("id") ?? "");
  const direction = formData.get("direction") === "up" ? -1 : 1;
  const zones = await prisma.deliveryZone.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }], select: { id: true } });
  const ids = zones.map((z) => z.id);
  const index = ids.indexOf(id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= ids.length) return;
  [ids[index], ids[target]] = [ids[target], ids[index]];
  for (const [position, zoneId] of ids.entries()) await prisma.deliveryZone.update({ where: { id: zoneId }, data: { position } });
  revalidatePath("/admin/delivery");
}
