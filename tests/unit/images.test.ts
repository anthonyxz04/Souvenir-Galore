import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { ImageValidationError, processImage, renditionWidths } from "@/lib/storage/process";

async function makeJpeg(width: number, height: number, withGps = false) {
  let pipeline = sharp({ create: { width, height, channels: 3, background: { r: 200, g: 180, b: 150 } } }).jpeg();
  if (withGps) pipeline = pipeline.withExif({ IFD0: { Copyright: "secret-owner" } });
  return pipeline.toBuffer();
}

describe("renditionWidths", () => {
  it("never upscales and always includes the largest usable width", () => {
    expect(renditionWidths(4000)).toEqual([320, 640, 960, 1600]);
    expect(renditionWidths(800)).toEqual([320, 640, 800]);
    expect(renditionWidths(300)).toEqual([300]);
  });
});

describe("processImage", () => {
  it("creates WebP renditions and strips metadata", async () => {
    const input = await makeJpeg(1200, 900, true);
    const result = await processImage(input);
    expect(result.width).toBe(1200);
    expect(result.height).toBe(900);
    expect(result.renditions.map((r) => r.width)).toEqual([320, 640, 960, 1200]);
    for (const rendition of result.renditions) {
      const meta = await sharp(rendition.body).metadata();
      expect(meta.format).toBe("webp");
      expect(meta.width).toBe(rendition.width);
      expect(meta.exif).toBeUndefined();
    }
  });

  it("rejects files that are not images", async () => {
    await expect(processImage(Buffer.from("<svg onload=alert(1)></svg>"))).rejects.toBeInstanceOf(ImageValidationError);
    await expect(processImage(Buffer.from("GIF89a fake"))).rejects.toBeInstanceOf(ImageValidationError);
  });

  it("rejects SVG even when it is valid", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400"/></svg>');
    await expect(processImage(svg)).rejects.toBeInstanceOf(ImageValidationError);
  });

  it("rejects an image whose header is valid but whose pixels can't be decoded", async () => {
    const noisy = await sharp({ create: { width: 800, height: 800, channels: 3, background: { r: 0, g: 0, b: 0 }, noise: { type: "gaussian", mean: 128, sigma: 40 } } }).jpeg().toBuffer();
    const truncated = noisy.subarray(0, Math.floor(noisy.length / 3));
    await expect(processImage(truncated)).rejects.toBeInstanceOf(ImageValidationError);
  });

  it("rejects images that are too small", async () => {
    await expect(processImage(await makeJpeg(100, 100))).rejects.toThrow(/too small/);
  });
});
