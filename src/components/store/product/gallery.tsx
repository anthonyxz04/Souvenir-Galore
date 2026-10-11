"use client";

import { useRef, useState, type PointerEvent } from "react";
import { mediaSrcSet, mediaUrl, type MediaRef } from "@/lib/storage/urls";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChevronLeftIcon, ChevronRightIcon, ZoomIcon } from "@/components/ui/icons";
import { ImagePlaceholder } from "@/components/ui/responsive-image";

type GalleryImage = MediaRef & { alt: string };

/**
 * Product gallery: swipe or use arrows to browse, hover to magnify on desktop,
 * tap to open a full-screen view with large images.
 */
export function ProductGallery({ images, base, productName }: { images: GalleryImage[]; base: string; productName: string }) {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const touchStart = useRef<number | null>(null);

  if (images.length === 0) {
    return (
      <div className="aspect-[4/5] overflow-hidden rounded-[var(--radius-image)]">
        <ImagePlaceholder label={productName} />
      </div>
    );
  }

  const current = images[index];
  const go = (delta: number) => setIndex((i) => (i + delta + images.length) % images.length);

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType !== "mouse") return;
    const rect = event.currentTarget.getBoundingClientRect();
    setZoom({ x: ((event.clientX - rect.left) / rect.width) * 100, y: ((event.clientY - rect.top) / rect.height) * 100 });
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(true)}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setZoom(null)}
          onTouchStart={(event) => (touchStart.current = event.touches[0]?.clientX ?? null)}
          onTouchEnd={(event) => {
            const start = touchStart.current;
            const end = event.changedTouches[0]?.clientX;
            touchStart.current = null;
            if (start === null || end === undefined) return;
            if (Math.abs(end - start) > 40) {
              event.preventDefault();
              go(end < start ? 1 : -1);
            }
          }}
          className="group relative block aspect-[4/5] w-full cursor-zoom-in overflow-hidden rounded-[var(--radius-image)] bg-plaster"
          aria-label={`Enlarge image ${index + 1} of ${images.length}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={current.key}
            src={mediaUrl(base, current, 960)}
            srcSet={mediaSrcSet(base, current)}
            sizes="(min-width: 1024px) 55vw, 100vw"
            alt={current.alt}
            width={current.width ?? undefined}
            height={current.height ?? undefined}
            fetchPriority={index === 0 ? "high" : undefined}
            className="h-full w-full object-cover transition-transform duration-200 ease-out"
            style={zoom ? { transform: "scale(2)", transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
          />
          <span className="pointer-events-none absolute bottom-3 right-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-plaster/90 text-ink opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <ZoomIcon size={18} />
          </span>
        </button>
        {images.length > 1 ? (
          <>
            <button type="button" onClick={() => go(-1)} className="absolute left-3 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-plaster/90 text-ink shadow-sm hover:bg-plaster" aria-label="Previous image">
              <ChevronLeftIcon />
            </button>
            <button type="button" onClick={() => go(1)} className="absolute right-3 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-plaster/90 text-ink shadow-sm hover:bg-plaster" aria-label="Next image">
              <ChevronRightIcon />
            </button>
            <p className="sr-only" aria-live="polite">
              Image {index + 1} of {images.length}
            </p>
          </>
        ) : null}
      </div>

      {images.length > 1 ? (
        <ul className="scrollbar-none flex gap-2.5 overflow-x-auto pb-1" aria-label="Product images">
          {images.map((image, i) => (
            <li key={image.key} className="shrink-0">
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show image ${i + 1}`}
                aria-current={i === index ? "true" : undefined}
                className={cn(
                  "block h-20 w-16 overflow-hidden rounded-md bg-plaster ring-offset-2 ring-offset-limestone transition sm:h-24 sm:w-20",
                  i === index ? "ring-2 ring-ink" : "opacity-75 hover:opacity-100",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl(base, image, 320)} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={productName} hideTitle className="h-dvh max-h-dvh w-screen max-w-none rounded-none bg-ink/95 [&>div]:p-0 [&>button:last-child]:bg-white [&>button:last-child]:text-ink">
          <div className="relative flex h-[calc(100dvh-1rem)] items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mediaUrl(base, current, 1600)} alt={current.alt} className="max-h-full max-w-full object-contain" />
            {images.length > 1 ? (
              <>
                <button type="button" onClick={() => go(-1)} className="absolute left-3 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink" aria-label="Previous image">
                  <ChevronLeftIcon />
                </button>
                <button type="button" onClick={() => go(1)} className="absolute right-3 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink" aria-label="Next image">
                  <ChevronRightIcon />
                </button>
                <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-3 py-1 text-sm text-ink">
                  {index + 1} / {images.length}
                </p>
              </>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
