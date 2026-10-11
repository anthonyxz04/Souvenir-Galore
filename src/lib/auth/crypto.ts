import { createHash, createHmac, randomBytes, randomInt } from "node:crypto";

/** URL-safe random token with `bytes` bytes of entropy (default 256 bits). */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function appSecret(): string {
  const secret = process.env.APP_SECRET;
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("APP_SECRET must be set to a random string of at least 32 characters.");
    }
    return "development-only-secret-do-not-use-in-production";
  }
  return secret;
}

export function hmac(value: string): string {
  return createHmac("sha256", appSecret()).update(value).digest("hex");
}

/** Pseudonymous IP for rate limiting and audit logs (raw IPs are never stored). */
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return hmac(`ip:${ip}`).slice(0, 32);
}

const READABLE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Short human-friendly code (no 0/O/1/I), e.g. for custom-request numbers. */
export function readableCode(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i += 1) out += READABLE_ALPHABET[randomInt(READABLE_ALPHABET.length)];
  return out;
}
