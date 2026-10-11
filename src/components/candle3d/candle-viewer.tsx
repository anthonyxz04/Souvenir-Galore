"use client";

import localFont from "next/font/local";
import { useEffect, useRef, useState } from "react";
import type { CandleLook } from "@/lib/candle3d/config";
import type { CandleScene, SceneFonts } from "@/lib/candle3d/scene";
import { cn } from "@/lib/utils";

/** Handwritten lettering for labels (only downloaded where the 3D preview is shown). */
const script = localFont({ src: "../../app/fonts/dancing-script-latin-600.woff", weight: "600", display: "swap", variable: "--font-script" });

type Status = "loading" | "ready" | "unsupported";

function webglAvailable(): boolean {
  try {
    const probe = document.createElement("canvas");
    return Boolean(probe.getContext("webgl2") || probe.getContext("webgl"));
  } catch {
    return false;
  }
}

function sceneFonts(): SceneFonts {
  const styles = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
  return {
    serif: read("--font-marcellus", "Georgia, serif"),
    sans: read("--font-figtree", "system-ui, sans-serif"),
    script: script.style.fontFamily,
  };
}

/**
 * Interactive 3D candle. Shows a still placeholder while three.js loads, and a
 * short message if the device can't draw 3D (photos stay available).
 */
export function CandleViewer({ look, description, compact = false, className }: { look: CandleLook; description: string; compact?: boolean; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<CandleScene | null>(null);
  const lookRef = useRef(look);
  const [status, setStatus] = useState<Status>("loading");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!webglAvailable()) {
      setStatus("unsupported");
      return;
    }
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    import("@/lib/candle3d/scene")
      .then(({ createCandleScene }) => {
        if (cancelled || !canvasRef.current) return;
        sceneRef.current = createCandleScene(canvasRef.current, lookRef.current, {
          fonts: sceneFonts(),
          reducedMotion,
          compact,
          onInteract: () => setTouched(true),
        });
        setStatus("ready");
      })
      .catch((error) => {
        console.error("[3d] preview unavailable", error instanceof Error ? error.message : error);
        if (!cancelled) setStatus("unsupported");
      });
    const canvas = canvasRef.current;
    const onLost = (event: Event) => {
      event.preventDefault();
      setStatus("unsupported");
    };
    canvas?.addEventListener("webglcontextlost", onLost);
    return () => {
      cancelled = true;
      canvas?.removeEventListener("webglcontextlost", onLost);
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, [compact]);

  useEffect(() => {
    lookRef.current = look;
    sceneRef.current?.update(look);
  }, [look]);

  return (
    <div className={cn("relative overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_50%_38%,#f7f1e8,#e9dfd1)]", script.variable, className)}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`3D preview. ${description}`}
        data-candle-preview={status}
        className={cn("block h-full w-full select-none transition-opacity duration-500", status === "ready" ? "cursor-grab opacity-100 active:cursor-grabbing" : "opacity-0")}
      />
      {status === "loading" ? (
        <p className="absolute inset-0 flex items-center justify-center text-sm text-ink-soft" aria-live="polite">
          Loading the 3D preview…
        </p>
      ) : null}
      {status === "unsupported" ? (
        <p className="absolute inset-0 flex items-center justify-center px-8 text-center text-sm text-ink-soft">
          The 3D preview isn&apos;t available on this device. Your choices still go into your order exactly as you pick them.
        </p>
      ) : null}
      {status === "ready" && !compact ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3 sm:p-4">
          <p className={cn("rounded-full bg-white/80 px-3 py-1.5 text-[0.8125rem] text-ink-soft backdrop-blur transition-opacity duration-500", touched ? "opacity-0" : "opacity-100")}>
            Drag to turn it around
          </p>
          <button
            type="button"
            onClick={() => {
              sceneRef.current?.resetView();
              setTouched(false);
            }}
            className="pointer-events-auto rounded-full bg-white/85 px-3 py-1.5 text-[0.8125rem] font-medium text-ink shadow-sm backdrop-blur hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-olive"
          >
            Reset view
          </button>
        </div>
      ) : null}
    </div>
  );
}
