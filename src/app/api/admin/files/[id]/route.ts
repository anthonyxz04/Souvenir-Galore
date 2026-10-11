import { prisma } from "@/lib/db";
import { AuthorizationError, assertPermission } from "@/lib/auth/guards";
import { storage } from "@/lib/storage";
import { renditionKey } from "@/lib/storage/images";

/** Streams a private customer upload (e.g. custom-order reference image) to authorized staff only. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await assertPermission("requests:manage");
  } catch (error) {
    if (error instanceof AuthorizationError) return new Response("Not found", { status: 404 });
    throw error;
  }
  const { id } = await params;
  const asset = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!asset || asset.visibility !== "PRIVATE" || asset.renditions.length === 0) return new Response("Not found", { status: 404 });
  const requested = Number(new URL(request.url).searchParams.get("w"));
  const widths = [...asset.renditions].sort((a, b) => a - b);
  const width = widths.find((w) => w >= requested) ?? widths[widths.length - 1];
  const file = await storage().get(renditionKey(asset.key, width), "PRIVATE");
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.body), {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
