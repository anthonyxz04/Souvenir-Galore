"use client";

import { useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { describeLook, resolveLook, type Preview3dConfig } from "@/lib/candle3d/config";
import { cn } from "@/lib/utils";
import { CandleViewer } from "@/components/candle3d/candle-viewer";
import { ProductGallery } from "./gallery";
import { useCustomization } from "./customization";

type GalleryProps = ComponentProps<typeof ProductGallery>;

/**
 * Photos, plus a 3D preview that follows the customer's choices when the owner
 * has turned it on for this product.
 */
export function ProductMedia({ preview3d, ...gallery }: GalleryProps & { preview3d: Preview3dConfig | null }) {
  const customization = useCustomization();
  const [view, setView] = useState<"3d" | "photos">("3d");
  const selection = customization?.selection;
  const look = useMemo(() => (preview3d ? resolveLook(preview3d, selection ?? {}, gallery.productName) : null), [preview3d, selection, gallery.productName]);
  const enabled = Boolean(preview3d?.enabled && look);

  // On phones the preview sits above the options: once it's scrolled away,
  // offer a shortcut back to it.
  const panelRef = useRef<HTMLDivElement>(null);
  const [offscreen, setOffscreen] = useState(false);
  useEffect(() => {
    const panel = panelRef.current;
    if (!enabled || !panel) return;
    const observer = new IntersectionObserver(([entry]) => setOffscreen(!entry.isIntersecting && entry.boundingClientRect.top < 0), { threshold: 0.15 });
    observer.observe(panel);
    return () => observer.disconnect();
  }, [enabled, view]);
  const hasChoices = Object.keys(selection ?? {}).length > 0;

  if (!preview3d || !look || !enabled) return <ProductGallery {...gallery} />;

  const named = (binding: string) => (binding && selection?.[binding]) || undefined;
  const description = describeLook(look, { jar: named(preview3d.bindings.jarColor), wax: named(preview3d.bindings.waxColor), lid: named(preview3d.bindings.lid) });
  const hasPhotos = gallery.images.length > 0;
  const tab = (id: "3d" | "photos", label: string) => (
    <button
      type="button"
      role="tab"
      id={`media-tab-${id}`}
      aria-selected={view === id}
      aria-controls={`media-panel-${id}`}
      onClick={() => setView(id)}
      className={cn(
        "rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-olive",
        view === id ? "bg-ink text-white" : "text-ink-soft hover:text-ink",
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-3">
      {hasPhotos ? (
        <div role="tablist" aria-label="Product views" className="inline-flex gap-1 rounded-full bg-plaster p-1 ring-1 ring-line/70">
          {tab("3d", "Design yours in 3D")}
          {tab("photos", `Photos (${gallery.images.length})`)}
        </div>
      ) : null}
      <div ref={panelRef} id="media-panel-3d" role={hasPhotos ? "tabpanel" : undefined} aria-labelledby={hasPhotos ? "media-tab-3d" : undefined} hidden={view !== "3d"} className="scroll-mt-24">
        {view === "3d" ? <CandleViewer look={look} description={description} className="aspect-[4/5] w-full" /> : null}
        <p className="mt-2 text-[0.8125rem] text-ink-soft">
          A preview of your choices. Each candle is made by hand, so the colors and lettering on yours may differ slightly.
        </p>
      </div>
      {view === "3d" && offscreen && hasChoices ? (
        <button
          type="button"
          onClick={() => panelRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" })}
          className="fixed bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-full bg-ink px-5 py-3 text-sm font-medium text-white shadow-lg lg:hidden"
        >
          See your design in 3D
        </button>
      ) : null}
      {hasPhotos ? (
        <div id="media-panel-photos" role="tabpanel" aria-labelledby="media-tab-photos" hidden={view !== "photos"}>
          {view === "photos" ? <ProductGallery {...gallery} /> : null}
        </div>
      ) : null}
    </div>
  );
}
