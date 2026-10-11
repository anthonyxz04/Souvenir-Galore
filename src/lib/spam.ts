/**
 * Layered spam protection for public forms:
 *  1. Honeypot field ("website") that people never see or fill in.
 *  2. Minimum time between the form rendering and submission.
 *  3. Rate limiting per IP (see rate-limit.ts).
 *  4. Optional Cloudflare Turnstile when keys are configured.
 */

import { env } from "./env";

export const HONEYPOT_FIELD = "website";
export const RENDERED_AT_FIELD = "_rendered";
const MIN_FILL_MS = 2500;
const MAX_FORM_AGE_MS = 1000 * 60 * 60 * 24;

export type SpamCheck = { ok: true } | { ok: false; reason: "honeypot" | "too-fast" | "stale" | "captcha" };

export async function checkSpam(formData: FormData, ip: string | null): Promise<SpamCheck> {
  const honeypot = formData.get(HONEYPOT_FIELD);
  if (typeof honeypot === "string" && honeypot.trim() !== "") return { ok: false, reason: "honeypot" };

  const renderedAt = Number(formData.get(RENDERED_AT_FIELD));
  if (Number.isFinite(renderedAt) && renderedAt > 0) {
    const age = Date.now() - renderedAt;
    if (age < MIN_FILL_MS) return { ok: false, reason: "too-fast" };
    if (age > MAX_FORM_AGE_MS) return { ok: false, reason: "stale" };
  }

  if (env.turnstileSecret) {
    const token = formData.get("cf-turnstile-response");
    if (typeof token !== "string" || !token) return { ok: false, reason: "captcha" };
    const valid = await verifyTurnstile(token, ip);
    if (!valid) return { ok: false, reason: "captcha" };
  }
  return { ok: true };
}

async function verifyTurnstile(token: string, ip: string | null): Promise<boolean> {
  try {
    const body = new URLSearchParams({ secret: env.turnstileSecret, response: token });
    if (ip) body.set("remoteip", ip);
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(5000),
    });
    const data = (await response.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

export function spamMessage(check: Exclude<SpamCheck, { ok: true }>): string {
  if (check.reason === "captcha") return "Please complete the verification check and try again.";
  if (check.reason === "stale") return "This form has expired. Refresh the page and try again.";
  return "We couldn't send that. Please wait a moment and try again.";
}
