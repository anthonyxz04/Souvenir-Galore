import { cache } from "react";
import { prisma } from "../db";
import type { CurrencyConfig } from "../money";
import { formatMoney } from "../money";
import { parseSettings, SETTINGS_SCHEMAS, type SettingsKey, type SettingsValue } from "./schemas";

export type AllSettings = { [K in SettingsKey]: SettingsValue<K> };

/** Loads every settings group once per request. */
export const getAllSettings = cache(async (): Promise<AllSettings> => {
  const rows = await prisma.setting.findMany();
  const byKey = new Map(rows.map((row) => [row.key, row.value]));
  const keys = Object.keys(SETTINGS_SCHEMAS) as SettingsKey[];
  return Object.fromEntries(keys.map((key) => [key, parseSettings(key, byKey.get(key))])) as AllSettings;
});

export async function getSettings<K extends SettingsKey>(key: K): Promise<SettingsValue<K>> {
  const all = await getAllSettings();
  return all[key];
}

export async function saveSettings<K extends SettingsKey>(
  key: K,
  value: unknown,
  actorId: string | null,
): Promise<{ ok: true; value: SettingsValue<K> } | { ok: false; errors: Record<string, string> }> {
  const result = SETTINGS_SCHEMAS[key].safeParse(value);
  if (!result.success) {
    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) errors[String(issue.path[0] ?? "form")] = issue.message;
    return { ok: false, errors };
  }
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: result.data as object, updatedById: actorId },
    update: { value: result.data as object, updatedById: actorId },
  });
  return { ok: true, value: result.data as SettingsValue<K> };
}

export async function getCurrency(): Promise<CurrencyConfig> {
  const commerce = await getSettings("commerce");
  return { code: commerce.currencyCode, decimals: commerce.currencyDecimals, locale: commerce.currencyLocale };
}

/** Returns a formatter bound to the store currency. */
export async function getMoneyFormatter(): Promise<(minor: number) => string> {
  const currency = await getCurrency();
  return (minor: number) => formatMoney(minor, currency);
}
