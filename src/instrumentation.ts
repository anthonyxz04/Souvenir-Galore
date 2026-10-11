/**
 * Runs once when the server starts. In production it checks the configuration
 * and refuses to start without the settings the store cannot work without,
 * instead of failing later on a customer's sign-in or checkout.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  // Built on Netlify before the settings existed: the site shows the setup page instead.
  if (process.env.BUILD_SETUP_MISSING) {
    console.error(`[config] Setup not finished. Missing at build time: ${process.env.BUILD_SETUP_MISSING}. Add them and redeploy.`);
    return;
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  if (!process.env.DATABASE_URL && !process.env.NETLIFY_DB_URL) errors.push("No database: set DATABASE_URL (or deploy on Netlify, which provides NETLIFY_DB_URL).");
  if ((process.env.APP_SECRET ?? "").length < 32) errors.push("APP_SECRET must be set to at least 32 random characters (openssl rand -base64 48).");

  if (!(process.env.APP_URL || process.env.URL || process.env.BUILD_SITE_URL || "").startsWith("https://")) warnings.push("APP_URL should be the store's public https:// address.");
  if (!process.env.SMTP_HOST) warnings.push("SMTP is not configured: customers cannot verify their email or reset passwords, and no order emails are sent.");
  if (process.env.STORAGE_DRIVER === "s3" && !process.env.S3_PRIVATE_BUCKET) {
    warnings.push("S3_PRIVATE_BUCKET is not set: customer uploads are stored in S3_BUCKET, which must then be private.");
  }
  if (process.env.STORAGE_DRIVER !== "s3" && process.env.VERCEL) warnings.push("STORAGE_DRIVER should be \"s3\" on Vercel; uploaded files would otherwise be lost.");
  if (process.env.STORAGE_DRIVER === "local" && (process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT)) warnings.push("STORAGE_DRIVER is \"local\" on Netlify; use \"netlify\" (Netlify Blobs) so uploaded photos are kept.");

  for (const warning of warnings) console.warn(`[config] ${warning}`);
  if (errors.length) {
    for (const error of errors) console.error(`[config] ${error}`);
    throw new Error(`Souvenir Galore cannot start: ${errors.join(" ")}`);
  }
}
