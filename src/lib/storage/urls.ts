/**
 * Build image URLs and srcsets for public media. Safe to import from client
 * components (no Node APIs). The base URL is passed in from the server.
 */

export type MediaRef = {
  key: string;
  renditions: number[];
  width?: number | null;
  height?: number | null;
  alt?: string | null;
};

export function mediaUrl(base: string, media: MediaRef, preferredWidth = 960): string {
  const widths = [...media.renditions].sort((a, b) => a - b);
  const chosen = widths.find((w) => w >= preferredWidth) ?? widths[widths.length - 1] ?? preferredWidth;
  return `${base}/${media.key}/${chosen}.webp`;
}

export function mediaSrcSet(base: string, media: MediaRef): string {
  return [...media.renditions]
    .sort((a, b) => a - b)
    .map((w) => `${base}/${media.key}/${w}.webp ${w}w`)
    .join(", ");
}
