import { mediaSrcSet, mediaUrl, type MediaRef } from "@/lib/storage/urls";
import { cn } from "@/lib/utils";

type Props = {
  media: MediaRef;
  base: string;
  alt: string;
  sizes: string;
  className?: string;
  priority?: boolean;
  preferredWidth?: number;
};

/**
 * Serves pre-generated WebP renditions with srcset so phones download small
 * files. Width/height are set to prevent layout shift.
 */
export function ResponsiveImage({ media, base, alt, sizes, className, priority, preferredWidth = 960 }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={mediaUrl(base, media, preferredWidth)}
      srcSet={mediaSrcSet(base, media)}
      sizes={sizes}
      alt={alt}
      width={media.width ?? undefined}
      height={media.height ?? undefined}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      className={cn("block", className)}
    />
  );
}

/** Shown when a product has no photo yet. */
export function ImagePlaceholder({ label, className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex h-full w-full items-center justify-center bg-limestone-deep text-ink-soft/70", className)} role="img" aria-label={label ?? "No photo yet"}>
      <svg viewBox="0 0 64 64" className="h-1/4 w-1/4" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
        <path d="M22 26h20l-1.5 22h-17z" />
        <path d="M32 26v-5" />
        <path d="M32 21c2.5-2.2 2.7-5 0-8-2.7 3-2.5 5.8 0 8Z" />
      </svg>
    </div>
  );
}
