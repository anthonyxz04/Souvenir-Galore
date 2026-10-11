import type { NextConfig } from "next";

function missingSetupOnNetlify(): string {
  if (process.env.NETLIFY !== "true") return "";
  const missing: string[] = [];
  // The database needs no setting on Netlify (Netlify Database is provided automatically).
  if ((process.env.APP_SECRET ?? "").length < 32) missing.push("APP_SECRET");
  return missing.join(",");
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The site's public address, captured at build time so links in emails, the
  // sitemap and canonical tags are right even if APP_URL isn't set at runtime.
  // On Netlify, URL is the site's main address (your custom domain once added).
  env: {
    BUILD_SITE_URL: process.env.APP_URL || process.env.URL || "",
    // On Netlify, required settings are present at build time. If any are
    // missing, every page shows a "finish setup" notice instead of failing.
    BUILD_SETUP_MISSING: missingSetupOnNetlify(),
  },
  reactStrictMode: true,
  // Native / server-only packages that must not be bundled.
  serverExternalPackages: ["sharp", "nodemailer", "@aws-sdk/client-s3"],
  experimental: {
    serverActions: {
      // Customer reference images are compressed in the browser before upload.
      // Keep this below your host's request-body limit (Vercel: 4.5 MB).
      bodySizeLimit: "4mb",
    },
  },
  images: {
    // Product images are pre-rendered into WebP renditions at upload time
    // (see src/lib/storage/images.ts), so Next's optimizer is not needed.
    unoptimized: true,
  },
  async headers() {
    // The Content-Security-Policy (with a per-request nonce) is set in src/proxy.ts.
    const security = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    ];
    if (process.env.NODE_ENV === "production") {
      security.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" });
    }
    return [{ source: "/:path*", headers: security }];
  },
};

export default nextConfig;
