/**
 * Password hashing with scrypt (memory-hard, built into Node.js — no native
 * add-on to install). Parameters follow the OWASP Password Storage Cheat Sheet
 * (N=2^16, r=8, p=2) and are stored inside each hash so they can be raised later.
 *
 * Format: scrypt$<log2N>$<r>$<p>$<salt base64>$<hash base64>
 */

import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

type Params = { log2N: number; r: number; p: number };

const PRODUCTION_PARAMS: Params = { log2N: 16, r: 8, p: 2 };
// Fast parameters for automated tests only. Never used outside NODE_ENV=test.
const TEST_PARAMS: Params = { log2N: 12, r: 8, p: 1 };

function currentParams(): Params {
  return process.env.NODE_ENV === "test" ? TEST_PARAMS : PRODUCTION_PARAMS;
}

function deriveKey(password: string, salt: Buffer, params: Params): Promise<Buffer> {
  const N = 2 ** params.log2N;
  const options: ScryptOptions = { N, r: params.r, p: params.p, maxmem: 256 * N * params.r + 1024 * 1024 };
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const params = currentParams();
  const salt = randomBytes(SALT_LENGTH);
  const key = await deriveKey(password, salt, params);
  return ["scrypt", params.log2N, params.r, params.p, salt.toString("base64"), key.toString("base64")].join("$");
}

function parseHash(stored: string): (Params & { salt: Buffer; key: Buffer }) | null {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;
  const [log2N, r, p] = parts.slice(1, 4).map(Number);
  if (![log2N, r, p].every((n) => Number.isInteger(n) && n > 0) || log2N > 20) return null;
  return { log2N, r, p, salt: Buffer.from(parts[4], "base64"), key: Buffer.from(parts[5], "base64") };
}

export async function verifyPassword(stored: string, password: string): Promise<boolean> {
  const parsed = parseHash(stored);
  if (!parsed) return false;
  const derived = await deriveKey(password, parsed.salt, parsed);
  return derived.length === parsed.key.length && timingSafeEqual(derived, parsed.key);
}

/** True when the stored hash uses weaker parameters than the current ones. */
export function needsRehash(stored: string): boolean {
  const parsed = parseHash(stored);
  if (!parsed) return true;
  const params = currentParams();
  return parsed.log2N < params.log2N || parsed.r < params.r || parsed.p < params.p;
}

/** A hash of a random password, used to keep login timing constant for unknown emails. */
let dummyHashPromise: Promise<string> | null = null;
export function dummyPasswordHash(): Promise<string> {
  dummyHashPromise ??= hashPassword(randomBytes(24).toString("base64"));
  return dummyHashPromise;
}

// ─────────────────────────────────────────────────────────────
// Password policy
// ─────────────────────────────────────────────────────────────

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "password12",
  "password123",
  "1234567890",
  "12345678910",
  "qwertyuiop",
  "qwerty1234",
  "1q2w3e4r5t",
  "iloveyou12",
  "letmein123",
  "welcome123",
  "admin12345",
  "administrator",
  "souvenirgalore",
  "souvenir123",
  "lebanon123",
  "beirut1234",
  "0123456789",
  "abcdefghij",
  "aaaaaaaaaa",
]);

/** Returns an error message, or null when the password is acceptable. */
export function passwordPolicyError(password: string, context: { email?: string; name?: string } = {}): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (password.length > PASSWORD_MAX_LENGTH) return `Use at most ${PASSWORD_MAX_LENGTH} characters.`;
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) return "This password is too common. Choose something harder to guess.";
  if (/^(.)\1+$/.test(password)) return "Don't use a single repeated character.";
  const emailName = context.email?.split("@")[0]?.toLowerCase();
  if (emailName && emailName.length >= 4 && lower.includes(emailName)) {
    return "Don't include your email address in your password.";
  }
  const name = context.name?.trim().toLowerCase();
  if (name && name.length >= 4 && lower === name.replace(/\s+/g, "")) return "Don't use your name as your password.";
  return null;
}
