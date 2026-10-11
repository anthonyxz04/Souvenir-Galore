import { timingSafeEqual } from "node:crypto";

/**
 * One-time owner setup link: /setup-owner?token=<SETUP_TOKEN>. Works only while
 * no owner account exists and only when SETUP_TOKEN (24+ characters) is set in
 * the hosting environment. After the owner is created the page disappears.
 */
export function isValidSetupToken(token: string | null | undefined): boolean {
  const expected = process.env.SETUP_TOKEN ?? "";
  if (expected.length < 24 || !token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
