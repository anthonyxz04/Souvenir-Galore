import { randomBytes } from "node:crypto";
import { prisma } from "../db";
import { storage, type Visibility } from "./index";
import { processImage } from "./process";

export { ImageValidationError } from "./process";

function newKey(prefix: string): string {
  const now = new Date();
  const month = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const id = randomBytes(12).toString("hex");
  return `${prefix}/${month}/${id}`;
}

export function renditionKey(baseKey: string, width: number): string {
  return `${baseKey}/${width}.webp`;
}

/** Validate, process, store and register an image. Returns the MediaAsset row. */
export async function storeImage(options: {
  buffer: Buffer;
  originalName: string | null;
  prefix: "products" | "content" | "categories" | "requests" | "branding";
  visibility: Visibility;
  uploadedById: string | null;
  alt?: string | null;
}) {
  const processed = await processImage(options.buffer);
  const baseKey = newKey(options.prefix);
  const driver = storage();
  const written: string[] = [];
  try {
    for (const rendition of processed.renditions) {
      const key = renditionKey(baseKey, rendition.width);
      await driver.put(key, rendition.body, "image/webp", options.visibility);
      written.push(key);
    }
    return await prisma.mediaAsset.create({
      data: {
        key: baseKey,
        visibility: options.visibility,
        originalName: options.originalName?.slice(0, 200) ?? null,
        mimeType: "image/webp",
        width: processed.width,
        height: processed.height,
        sizeBytes: processed.renditions.reduce((sum, r) => sum + r.body.length, 0),
        renditions: processed.renditions.map((r) => r.width),
        alt: options.alt?.slice(0, 200) ?? null,
        uploadedById: options.uploadedById,
      },
    });
  } catch (error) {
    await driver.delete(written, options.visibility).catch(() => undefined);
    throw error;
  }
}

/** Delete an asset's stored files. */
export async function deleteAssetFiles(asset: { key: string; renditions: number[]; visibility: Visibility }) {
  await storage().delete(
    asset.renditions.map((w) => renditionKey(asset.key, w)),
    asset.visibility,
  );
}
