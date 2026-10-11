/**
 * DATABASE_URL (any PostgreSQL), or on Netlify the built-in Netlify Database
 * connection (NETLIFY_DB_URL), which Netlify provides automatically.
 */
export function databaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL || process.env.NETLIFY_DB_URL || undefined;
  return url ? withServerlessDefaults(url) : undefined;
}

/**
 * Netlify Database scales to zero when idle, and the first connection after a
 * pause can take a few seconds, longer than Prisma's 5 s default. Allow 15 s
 * unless the URL already sets a timeout. Through a PgBouncer pooler (host
 * containing "-pooler"), Prisma also needs pgbouncer=true.
 */
export function withServerlessDefaults(url: string): string {
  try {
    const parsed = new URL(url);
    if (!/^postgres(ql)?:$/.test(parsed.protocol)) return url;
    if (!parsed.searchParams.has("connect_timeout")) parsed.searchParams.set("connect_timeout", "15");
    if (parsed.hostname.includes("-pooler") && !parsed.searchParams.has("pgbouncer")) parsed.searchParams.set("pgbouncer", "true");
    return parsed.toString();
  } catch {
    return url;
  }
}
