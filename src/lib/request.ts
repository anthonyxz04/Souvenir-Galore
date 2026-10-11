import "server-only";
import { headers } from "next/headers";
import { env } from "./env";

/** Client IP and user agent for rate limiting and audit logs. */
export async function getRequestMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  const h = await headers();
  let ip: string | null = null;
  if (env.trustProxy) {
    // Headers set by the hosting platform itself come first (Netlify, then
    // Cloudflare); X-Forwarded-For can carry values the visitor sent.
    const forwarded = h.get("x-forwarded-for");
    ip = h.get("x-nf-client-connection-ip") || h.get("cf-connecting-ip") || h.get("x-real-ip") || forwarded?.split(",")[0]?.trim() || null;
  }
  ip ??= h.get("x-real-ip");
  const userAgent = h.get("user-agent")?.slice(0, 300) ?? null;
  return { ip: ip || null, userAgent };
}

/**
 * Cross-site request protection for Route Handlers that change data.
 * (Server Actions already get this check from Next.js.)
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
