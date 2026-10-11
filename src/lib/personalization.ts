/**
 * Validation for per-product personalization fields (names, dates, messages).
 * Pure and isomorphic: used for instant feedback in the browser and as the
 * authoritative check on the server. Covered by tests/unit/personalization.test.ts.
 */

import type { PersonalizationFieldType } from "./domain";
import { stripControlChars } from "./text";

export type PersonalizationFieldDef = {
  id: string;
  label: string;
  type: PersonalizationFieldType;
  isRequired: boolean;
  maxLength: number | null;
  options: string[];
  priceDelta: number;
};

export type PersonalizationValue = {
  fieldId: string;
  label: string;
  value: string;
  priceDelta: number;
};

export type PersonalizationResult =
  | { ok: true; values: PersonalizationValue[]; surcharge: number }
  | { ok: false; errors: Record<string, string> };

export const DEFAULT_MAX_LENGTH: Record<PersonalizationFieldType, number> = {
  TEXT: 60,
  TEXTAREA: 300,
  DATE: 10,
  SELECT: 100,
};
const HARD_MAX_LENGTH = 500;

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function validatePersonalization(
  fields: PersonalizationFieldDef[],
  input: Record<string, unknown> | null | undefined,
): PersonalizationResult {
  const errors: Record<string, string> = {};
  const values: PersonalizationValue[] = [];
  let surcharge = 0;
  const source = input ?? {};

  for (const field of fields) {
    const raw = source[field.id];
    const multiline = field.type === "TEXTAREA";
    let value = typeof raw === "string" ? stripControlChars(raw, multiline).trim() : "";
    if (!multiline) value = value.replace(/\s+/g, " ");

    if (!value) {
      if (field.isRequired) errors[field.id] = `Enter ${field.label.toLowerCase()}.`;
      continue;
    }

    const maxLength = Math.min(field.maxLength ?? DEFAULT_MAX_LENGTH[field.type], HARD_MAX_LENGTH);
    if (value.length > maxLength) {
      errors[field.id] = `${field.label} can be at most ${maxLength} characters.`;
      continue;
    }

    if (field.type === "DATE" && !isValidIsoDate(value)) {
      errors[field.id] = `Enter a valid date for ${field.label.toLowerCase()}.`;
      continue;
    }

    if (field.type === "SELECT" && !field.options.includes(value)) {
      errors[field.id] = `Choose one of the options for ${field.label.toLowerCase()}.`;
      continue;
    }

    values.push({ fieldId: field.id, label: field.label, value, priceDelta: field.priceDelta });
    surcharge += Math.max(0, field.priceDelta);
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, values, surcharge };
}

/** Canonical string used (after hashing on the server) to merge identical cart lines. */
export function personalizationFingerprint(values: PersonalizationValue[]): string {
  if (values.length === 0) return "";
  return JSON.stringify(
    [...values].sort((a, b) => a.fieldId.localeCompare(b.fieldId)).map((v) => [v.fieldId, v.value]),
  );
}
