/** Typed access to environment configuration with safe defaults. */

function str(name: string, fallback = ""): string {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

export const env = {
  /** The site's public address. On Netlify, falls back to the site URL Netlify provides. */
  get appUrl(): string {
    // BUILD_SITE_URL is filled in at build time by next.config.ts (must be read literally).
    const buildSiteUrl = process.env.BUILD_SITE_URL || "";
    return str("APP_URL", str("URL", buildSiteUrl || "http://localhost:3000")).replace(/\/+$/, "");
  },
  get isProduction(): boolean {
    return process.env.NODE_ENV === "production";
  },
  /**
   * Secure (HTTPS-only, __Host- prefixed) cookies whenever the site's address
   * is https://. A production build tried locally over http:// (for example
   * from a phone on the same Wi-Fi) still lets people sign in.
   */
  get secureCookies(): boolean {
    return this.appUrl.startsWith("https://");
  },
  get trustProxy(): boolean {
    return str("TRUST_PROXY", "true") === "true";
  },
  get uploadMaxBytes(): number {
    const mb = Number(str("UPLOAD_MAX_MB", "4"));
    return Math.max(1, Math.min(20, Number.isFinite(mb) ? mb : 4)) * 1024 * 1024;
  },
  get turnstileSiteKey(): string {
    return str("NEXT_PUBLIC_TURNSTILE_SITE_KEY");
  },
  get turnstileSecret(): string {
    return str("TURNSTILE_SECRET_KEY");
  },
  get adminNotificationEmails(): string[] {
    return str("ADMIN_NOTIFICATION_EMAILS")
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
  },
};

export function absoluteUrl(path: string): string {
  return `${env.appUrl}${path.startsWith("/") ? path : `/${path}`}`;
}
