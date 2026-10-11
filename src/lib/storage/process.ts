/**
 * Image validation and processing (no database access — unit tested).
 *
 * Every upload is decoded with sharp: a file that is not a real JPEG, PNG,
 * WebP or AVIF image is rejected regardless of its name or MIME type. (HEIC
 * photos are converted to JPEG in the browser where the browser can read them,
 * e.g. Safari on iPhone; sharp's prebuilt binaries cannot decode HEIC itself.)
 * Images are auto-rotated, stripped of metadata (including GPS location) and
 * re-encoded as WebP renditions. SVG is never accepted (it can contain scripts).
 */

export const RENDITION_WIDTHS = [320, 640, 960, 1600] as const;
const MAX_WIDTH = 1600;
const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp", "avif", "heif"]);
const MAX_INPUT_PIXELS = 50_000_000; // about 8000 × 6000

export class ImageValidationError extends Error {}

export type ProcessedImage = {
  width: number;
  height: number;
  renditions: { width: number; body: Buffer }[];
};

export function renditionWidths(sourceWidth: number): number[] {
  const largest = Math.min(sourceWidth, MAX_WIDTH);
  return [...new Set([...RENDITION_WIDTHS.filter((w) => w < largest), largest])].sort((a, b) => a - b);
}

export async function processImage(input: Buffer, options: { minDimension?: number } = {}): Promise<ProcessedImage> {
  const sharp = (await import("sharp")).default;
  const minDimension = options.minDimension ?? 200;

  let metadata;
  try {
    metadata = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  } catch {
    throw new ImageValidationError("This file isn't a supported image. Upload a JPEG, PNG or WebP photo.");
  }
  if (!metadata.format || !ACCEPTED_FORMATS.has(metadata.format)) {
    throw new ImageValidationError("This image format isn't supported. Upload a JPEG, PNG or WebP photo.");
  }
  if (!metadata.width || !metadata.height) throw new ImageValidationError("This image has no dimensions.");

  // EXIF orientations 5–8 rotate the image by 90°, swapping width and height.
  const rotated = (metadata.orientation ?? 1) >= 5;
  const width = rotated ? metadata.height : metadata.width;
  const height = rotated ? metadata.width : metadata.height;
  if (width < minDimension || height < minDimension) {
    throw new ImageValidationError(`This image is too small. Use an image at least ${minDimension} × ${minDimension} pixels.`);
  }

  const oriented = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).rotate();
  let renditions: ProcessedImage["renditions"];
  try {
    renditions = await Promise.all(
      renditionWidths(width).map(async (w) => ({
        width: w,
        body: await oriented.clone().resize({ width: w, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(),
      })),
    );
  } catch {
    // e.g. a HEIC photo (readable header, undecodable pixels) or a truncated file.
    throw new ImageValidationError("We couldn't read this image. Save it as a JPEG or PNG and try again (iPhone photos: Settings → Camera → Formats → Most Compatible).");
  }

  return { width, height, renditions };
}
