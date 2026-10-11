/**
 * Object storage abstraction. Images are written once at upload time as WebP
 * renditions (see images.ts) and referenced by key from the database.
 *
 *   STORAGE_DRIVER=local   → files under STORAGE_LOCAL_DIR, served by /media/[...key]
 *   STORAGE_DRIVER=s3      → any S3-compatible bucket (AWS S3, Cloudflare R2, …)
 *   STORAGE_DRIVER=netlify → Netlify Blobs (built into Netlify, no extra account);
 *                            chosen automatically when running on Netlify
 *
 * PRIVATE files (customer reference images) are never publicly addressable:
 * they are only streamed to staff through an authorized route.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

export type Visibility = "PUBLIC" | "PRIVATE";

export interface StorageDriver {
  put(key: string, body: Buffer, contentType: string, visibility: Visibility): Promise<void>;
  get(key: string, visibility: Visibility): Promise<{ body: Buffer; contentType: string } | null>;
  delete(keys: string[], visibility: Visibility): Promise<void>;
}

const KEY_PATTERN = /^[a-z0-9][a-z0-9/_-]{0,200}\.(webp|jpg|png)$/;

export function assertSafeKey(key: string): void {
  if (!KEY_PATTERN.test(key) || key.includes("..") || key.includes("//")) {
    throw new Error("Invalid storage key");
  }
}

function contentTypeFor(key: string): string {
  if (key.endsWith(".webp")) return "image/webp";
  if (key.endsWith(".png")) return "image/png";
  return "image/jpeg";
}

class LocalDriver implements StorageDriver {
  private readonly root = path.resolve(process.env.STORAGE_LOCAL_DIR || "./storage");

  private filePath(key: string, visibility: Visibility): string {
    assertSafeKey(key);
    const base = path.join(this.root, visibility === "PUBLIC" ? "public" : "private");
    const full = path.resolve(base, key);
    if (!full.startsWith(base + path.sep)) throw new Error("Invalid storage path");
    return full;
  }

  async put(key: string, body: Buffer, _contentType: string, visibility: Visibility): Promise<void> {
    const target = this.filePath(key, visibility);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, body, { flag: "wx" });
  }

  async get(key: string, visibility: Visibility) {
    try {
      const body = await fs.readFile(this.filePath(key, visibility));
      return { body, contentType: contentTypeFor(key) };
    } catch {
      return null;
    }
  }

  async delete(keys: string[], visibility: Visibility): Promise<void> {
    await Promise.all(keys.map((key) => fs.rm(this.filePath(key, visibility), { force: true })));
  }
}

class S3Driver implements StorageDriver {
  private clientPromise: Promise<import("@aws-sdk/client-s3").S3Client> | null = null;

  private async client() {
    this.clientPromise ??= import("@aws-sdk/client-s3").then(
      ({ S3Client }) =>
        new S3Client({
          region: process.env.S3_REGION || "auto",
          endpoint: process.env.S3_ENDPOINT || undefined,
          forcePathStyle: Boolean(process.env.S3_ENDPOINT),
          credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
          },
        }),
    );
    return this.clientPromise;
  }

  private bucket(visibility: Visibility): string {
    const bucket = visibility === "PRIVATE" ? process.env.S3_PRIVATE_BUCKET || process.env.S3_BUCKET : process.env.S3_BUCKET;
    if (!bucket) throw new Error("S3_BUCKET is not configured");
    return bucket;
  }

  private objectKey(key: string, visibility: Visibility): string {
    assertSafeKey(key);
    return visibility === "PRIVATE" ? `private/${key}` : `public/${key}`;
  }

  async put(key: string, body: Buffer, contentType: string, visibility: Visibility): Promise<void> {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.client();
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket(visibility),
        Key: this.objectKey(key, visibility),
        Body: body,
        ContentType: contentType,
        CacheControl: visibility === "PUBLIC" ? "public, max-age=31536000, immutable" : "private, no-store",
      }),
    );
  }

  async get(key: string, visibility: Visibility) {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.client();
    try {
      const result = await client.send(
        new GetObjectCommand({ Bucket: this.bucket(visibility), Key: this.objectKey(key, visibility) }),
      );
      if (!result.Body) return null;
      const bytes = await result.Body.transformToByteArray();
      return { body: Buffer.from(bytes), contentType: result.ContentType ?? contentTypeFor(key) };
    } catch {
      return null;
    }
  }

  async delete(keys: string[], visibility: Visibility): Promise<void> {
    if (keys.length === 0) return;
    const { DeleteObjectsCommand } = await import("@aws-sdk/client-s3");
    const client = await this.client();
    await client.send(
      new DeleteObjectsCommand({
        Bucket: this.bucket(visibility),
        Delete: { Objects: keys.map((key) => ({ Key: this.objectKey(key, visibility) })) },
      }),
    );
  }
}

/**
 * Netlify Blobs: two site-wide stores (public images, private customer
 * uploads). Credentials are provided automatically inside Netlify Functions,
 * which is where the Next.js server runs on Netlify.
 */
class NetlifyBlobsDriver implements StorageDriver {
  private async store(visibility: Visibility) {
    const { getStore } = await import("@netlify/blobs");
    return getStore({ name: visibility === "PUBLIC" ? "sg-media-public" : "sg-media-private", consistency: "strong" });
  }

  async put(key: string, body: Buffer, contentType: string, visibility: Visibility): Promise<void> {
    assertSafeKey(key);
    const store = await this.store(visibility);
    const data = body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer;
    await store.set(key, data, { metadata: { contentType } });
  }

  async get(key: string, visibility: Visibility) {
    assertSafeKey(key);
    const store = await this.store(visibility);
    let result;
    try {
      result = await store.getWithMetadata(key, { type: "arrayBuffer" });
    } catch (error) {
      // Strong consistency needs a Netlify-provided endpoint; fall back to the
      // default (eventual) read if this environment doesn't offer it.
      if (error instanceof Error && error.name === "BlobsConsistencyError") {
        result = await store.getWithMetadata(key, { type: "arrayBuffer", consistency: "eventual" });
      } else {
        throw error;
      }
    }
    if (!result) return null;
    const type = typeof result.metadata?.contentType === "string" ? result.metadata.contentType : contentTypeFor(key);
    return { body: Buffer.from(result.data), contentType: type };
  }

  async delete(keys: string[], visibility: Visibility): Promise<void> {
    const store = await this.store(visibility);
    for (const key of keys) {
      assertSafeKey(key);
      await store.delete(key);
    }
  }
}

/** Which storage is in use: an explicit STORAGE_DRIVER, otherwise Netlify Blobs on Netlify, otherwise local disk. */
export function storageDriverName(): "local" | "s3" | "netlify" {
  const configured = process.env.STORAGE_DRIVER;
  if (configured === "s3" || configured === "netlify" || configured === "local") return configured;
  const onNetlify = Boolean(process.env.NETLIFY_BLOBS_CONTEXT || process.env.NETLIFY || (globalThis as { netlifyBlobsContext?: unknown }).netlifyBlobsContext);
  return onNetlify ? "netlify" : "local";
}

let driver: StorageDriver | null = null;

export function storage(): StorageDriver {
  if (!driver) {
    const name = storageDriverName();
    driver = name === "s3" ? new S3Driver() : name === "netlify" ? new NetlifyBlobsDriver() : new LocalDriver();
  }
  return driver;
}

/** Public URL base for media. With S3_PUBLIC_URL set, images load straight from the CDN. */
export function publicMediaBase(): string {
  if (storageDriverName() === "s3" && process.env.S3_PUBLIC_URL) {
    return `${process.env.S3_PUBLIC_URL.replace(/\/+$/, "")}/public`;
  }
  return "/media";
}
