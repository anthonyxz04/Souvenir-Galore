import { storage, assertSafeKey } from "@/lib/storage";

/**
 * Serves PUBLIC images (product photos, banners). Private customer uploads
 * are stored separately and are never reachable through this route.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key: parts } = await params;
  const key = parts.join("/");
  try {
    assertSafeKey(key);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const file = await storage().get(key, "PUBLIC");
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.body), {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      // Image keys are unique and never reused, so CDNs (Netlify's included) may keep them.
      "Netlify-CDN-Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
