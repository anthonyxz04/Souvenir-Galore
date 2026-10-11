import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { AuthorizationError, assertPermission } from "@/lib/auth/guards";
import type { Permission } from "@/lib/auth/permissions";
import { env } from "@/lib/env";
import { checkLimit } from "@/lib/rate-limit";
import { isSameOrigin } from "@/lib/request";
import { publicMediaBase } from "@/lib/storage";
import { ImageValidationError, storeImage } from "@/lib/storage/images";
import { mediaUrl } from "@/lib/storage/urls";

const PURPOSES: Record<string, { prefix: "products" | "content" | "categories" | "branding"; permission: Permission }> = {
  products: { prefix: "products", permission: "products:manage" },
  categories: { prefix: "categories", permission: "catalog:manage" },
  content: { prefix: "content", permission: "content:manage" },
  branding: { prefix: "branding", permission: "settings:manage" },
};

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "The upload couldn't be read. Try a smaller image." }, { status: 400 });
  }
  const purpose = PURPOSES[String(formData.get("purpose") ?? "")];
  if (!purpose) return NextResponse.json({ error: "Unknown upload type." }, { status: 400 });

  let user;
  try {
    user = await assertPermission(purpose.permission);
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 403 });
    throw error;
  }
  if (!(await checkLimit("upload", user.id))) {
    return NextResponse.json({ error: "Too many uploads in a short time. Wait a few minutes." }, { status: 429 });
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
  if (file.size > env.uploadMaxBytes) {
    return NextResponse.json({ error: `This image is larger than ${Math.round(env.uploadMaxBytes / 1024 / 1024)} MB.` }, { status: 413 });
  }

  try {
    const asset = await storeImage({
      buffer: Buffer.from(await file.arrayBuffer()),
      originalName: file.name,
      prefix: purpose.prefix,
      visibility: "PUBLIC",
      uploadedById: user.id,
    });
    await logAudit({ actor: user, action: "media.upload", entityType: "MediaAsset", entityId: asset.id, summary: file.name.slice(0, 120) });
    return NextResponse.json({
      asset: {
        id: asset.id,
        key: asset.key,
        renditions: asset.renditions,
        width: asset.width,
        height: asset.height,
        alt: asset.alt,
        url: mediaUrl(publicMediaBase(), asset, 640),
      },
    });
  } catch (error) {
    if (error instanceof ImageValidationError) return NextResponse.json({ error: error.message }, { status: 422 });
    console.error("[upload] failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "The image couldn't be saved. Please try again." }, { status: 500 });
  }
}
