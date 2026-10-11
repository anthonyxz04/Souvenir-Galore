/** Small, dependency-free text helpers that are safe on server and client. */

const COMBINING_MARKS = /[\u0300-\u036f]/g;

/** "Concrete Candle Jar – Large!" → "concrete-candle-jar-large" */
export function slugify(input: string, maxLength = 80): string {
  const slug = input
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
  return slug || "item";
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 100;
}

/** Remove ASCII control characters (keeps newlines and tabs when `multiline`). */
export function stripControlChars(value: string, multiline = false): string {
  // eslint-disable-next-line no-control-regex
  const pattern = multiline ? /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g;
  return value.replace(pattern, "");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Keep digits only, e.g. for WhatsApp links ("+961 70 123 456" → "96170123456"). */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return value.slice(0, Math.max(0, max - 1)).trimEnd() + "…";
}

/** Plain-text excerpt from Markdown, for meta descriptions. */
export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~|-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Only allow relative paths or http(s) URLs in admin-configured links. */
export function safeHref(href: string | null | undefined): string | null {
  if (!href) return null;
  const value = href.trim();
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.protocol === "http:" || url.protocol === "mailto:") return url.toString();
  } catch {
    return null;
  }
  return null;
}

/** Only allow same-site relative redirect targets (prevents open redirects). */
export function safeRedirectPath(target: string | null | undefined, fallback = "/"): string {
  if (!target) return fallback;
  if (!target.startsWith("/") || target.startsWith("//") || target.startsWith("/\\")) return fallback;
  return target;
}
