/**
 * Money helpers. Amounts are always integers in the currency's minor unit
 * (cents for USD). Floating point is only used at the very last step, for
 * display formatting.
 */

export type CurrencyConfig = {
  /** ISO 4217 code, e.g. "USD" or "LBP". */
  code: string;
  /** Number of minor-unit digits used for stored amounts (USD: 2, LBP: 0). */
  decimals: number;
  /** BCP 47 locale used for number formatting. */
  locale: string;
};

export const DEFAULT_CURRENCY: CurrencyConfig = { code: "USD", decimals: 2, locale: "en-US" };

export function formatMoney(minor: number, currency: CurrencyConfig = DEFAULT_CURRENCY): string {
  const major = minor / 10 ** currency.decimals;
  try {
    return new Intl.NumberFormat(currency.locale, {
      style: "currency",
      currency: currency.code,
      minimumFractionDigits: currency.decimals,
      maximumFractionDigits: currency.decimals,
    }).format(major);
  } catch {
    // Unknown currency code or locale — fall back to a plain format.
    return `${currency.code} ${major.toFixed(currency.decimals)}`;
  }
}

/**
 * Parse a human-entered amount ("12", "12.5", "1,250.00") into minor units.
 * Returns null for anything that is not a non-negative amount with at most
 * `decimals` fractional digits. Never goes through floating point.
 */
export function parseMoney(input: string | null | undefined, decimals: number): number | null {
  if (input === null || input === undefined) return null;
  const cleaned = String(input).trim().replace(/[\s,]/g, "");
  if (cleaned === "") return null;
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const [whole, fraction = ""] = cleaned.split(".");
  if (fraction.length > decimals) return null;
  const minorString = whole + fraction.padEnd(decimals, "0");
  const minor = Number(minorString);
  if (!Number.isSafeInteger(minor)) return null;
  return minor;
}

/** Format minor units as a plain decimal string for form inputs ("12.50"). */
export function toMajorString(minor: number | null | undefined, decimals: number): string {
  if (minor === null || minor === undefined) return "";
  const negative = minor < 0;
  const abs = Math.abs(Math.trunc(minor)).toString();
  if (decimals === 0) return (negative ? "-" : "") + abs;
  const padded = abs.padStart(decimals + 1, "0");
  const whole = padded.slice(0, padded.length - decimals);
  const fraction = padded.slice(padded.length - decimals);
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

/** Integer division rounded half-up (for non-negative values). */
export function divRoundHalfUp(numerator: number, denominator: number): number {
  if (denominator <= 0) throw new Error("denominator must be positive");
  if (numerator < 0) return -divRoundHalfUp(-numerator, denominator);
  return Math.floor((numerator * 2 + denominator) / (denominator * 2));
}

/** `percent`% of an amount, rounded down so discounts never exceed the stated percentage. */
export function percentOf(amount: number, percent: number): number {
  return Math.floor((amount * percent) / 100);
}

/**
 * Approximate conversion to a secondary display currency (e.g. LBP), using an
 * administrator-configured rate expressed as "secondary units per 1 base unit".
 * Display only — orders are always charged in the base currency.
 */
export function convertForDisplay(
  minor: number,
  base: CurrencyConfig,
  rate: number,
  target: CurrencyConfig,
): number {
  const major = minor / 10 ** base.decimals;
  return Math.round(major * rate * 10 ** target.decimals);
}
