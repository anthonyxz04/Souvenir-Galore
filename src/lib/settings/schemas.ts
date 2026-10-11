/**
 * Store settings, stored as JSON rows in the `Setting` table. Each group has a
 * Zod schema with safe defaults, so the store works before anything is configured
 * and invalid data can never be saved.
 *
 * Contact details are intentionally empty by default — the owner supplies them.
 */

import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).default("");

export const storeSettingsSchema = z.object({
  name: z.string().trim().min(1).max(80).default("Souvenir Galore"),
  tagline: optionalText(140).default("Handmade gifts, candles and keepsakes from Lebanon"),
  description: optionalText(300).default(
    "Handmade candles, personalized gifts, home décor and keepsakes, crafted in Lebanon.",
  ),
  logoAssetId: z.string().max(40).nullable().default(null),
});

export const contactSettingsSchema = z.object({
  email: z.union([z.literal(""), z.string().trim().email().max(200)]).default(""),
  phone: optionalText(40),
  /** International format digits, e.g. 96170123456. */
  whatsapp: z
    .string()
    .trim()
    .max(20)
    .regex(/^\d*$/, "Use digits only, including the country code (e.g. 96170123456).")
    .default(""),
  instagram: z
    .string()
    .trim()
    .max(60)
    .regex(/^[A-Za-z0-9._]*$/, "Enter the Instagram username without @ or a link.")
    .default(""),
  facebookUrl: z.union([z.literal(""), z.string().trim().url().max(300)]).default(""),
  tiktokUrl: z.union([z.literal(""), z.string().trim().url().max(300)]).default(""),
  address: optionalText(300),
  hours: optionalText(300),
  showWhatsappButton: z.boolean().default(true),
  showInstagramButton: z.boolean().default(true),
  showEmailButton: z.boolean().default(true),
});

export const commerceSettingsSchema = z.object({
  currencyCode: z
    .string()
    .trim()
    .regex(/^[A-Z]{3}$/)
    .default("USD"),
  currencyDecimals: z.number().int().min(0).max(3).default(2),
  currencyLocale: z.string().trim().max(20).default("en-US"),
  /** Optional approximate price in a second currency (e.g. LBP), display only. */
  secondaryCurrencyEnabled: z.boolean().default(false),
  secondaryCurrencyCode: z
    .string()
    .trim()
    .regex(/^[A-Z]{3}$/)
    .default("LBP"),
  secondaryCurrencyDecimals: z.number().int().min(0).max(3).default(0),
  /** Secondary currency units per 1 unit of the store currency. */
  secondaryCurrencyRate: z.number().positive().max(10_000_000).default(1),
  taxEnabled: z.boolean().default(false),
  taxLabel: z.string().trim().min(1).max(30).default("VAT"),
  taxRateBps: z.number().int().min(0).max(5000).default(0),
  taxIncluded: z.boolean().default(true),
  minOrderSubtotal: z.number().int().min(0).default(0),
  allowGuestCheckout: z.boolean().default(true),
  maxQuantityPerLine: z.number().int().min(1).max(1000).default(50),
  lowStockThreshold: z.number().int().min(0).max(1000).default(3),
  newBadgeDays: z.number().int().min(0).max(365).default(30),
  reviewsEnabled: z.boolean().default(true),
  customOrdersEnabled: z.boolean().default(true),
  customOrderUploadsEnabled: z.boolean().default(true),
  requireTermsAcceptance: z.boolean().default(true),
  /** Budget steps (in whole store-currency units) used by the gift finder. */
  budgetTiers: z.array(z.number().int().positive()).max(5).default([25, 50, 100]),
});

export const pickupSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  locationName: optionalText(120),
  address: optionalText(300),
  hours: optionalText(300),
  instructions: optionalText(600),
});

export const announcementSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  message: optionalText(160),
  href: optionalText(300),
});

export const newsletterSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  doubleOptIn: z.boolean().default(true),
  heading: optionalText(100).default("Letters from the workshop"),
  body: optionalText(300).default("New collections, seasonal pieces and the occasional behind-the-scenes look. No more than twice a month."),
  consentText: optionalText(300).default(
    "I agree to receive marketing emails from Souvenir Galore. I can unsubscribe at any time.",
  ),
});

export const seoSettingsSchema = z.object({
  defaultTitle: optionalText(70).default("Souvenir Galore"),
  defaultDescription: optionalText(170).default(
    "Handmade candles, personalized gifts, wedding and baptism favors, home décor and keepsakes, crafted in Lebanon.",
  ),
  ogImageAssetId: z.string().max(40).nullable().default(null),
});

export const SETTINGS_SCHEMAS = {
  store: storeSettingsSchema,
  contact: contactSettingsSchema,
  commerce: commerceSettingsSchema,
  pickup: pickupSettingsSchema,
  announcement: announcementSettingsSchema,
  newsletter: newsletterSettingsSchema,
  seo: seoSettingsSchema,
} as const;

export type SettingsKey = keyof typeof SETTINGS_SCHEMAS;
export type SettingsValue<K extends SettingsKey> = z.infer<(typeof SETTINGS_SCHEMAS)[K]>;

export type StoreSettings = SettingsValue<"store">;
export type ContactSettings = SettingsValue<"contact">;
export type CommerceSettings = SettingsValue<"commerce">;
export type PickupSettings = SettingsValue<"pickup">;
export type AnnouncementSettings = SettingsValue<"announcement">;
export type NewsletterSettings = SettingsValue<"newsletter">;
export type SeoSettings = SettingsValue<"seo">;

/** Parse stored JSON for a key; invalid or missing fields fall back to defaults. */
export function parseSettings<K extends SettingsKey>(key: K, raw: unknown): SettingsValue<K> {
  const schema = SETTINGS_SCHEMAS[key];
  const base = raw && typeof raw === "object" ? raw : {};
  const result = schema.safeParse(base);
  if (result.success) return result.data as SettingsValue<K>;
  // Drop invalid fields one by one rather than losing everything.
  const cleaned: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (typeof field === "string") delete cleaned[field];
  }
  const retry = schema.safeParse(cleaned);
  return (retry.success ? retry.data : schema.parse({})) as SettingsValue<K>;
}
