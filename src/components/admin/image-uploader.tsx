"use client";

import { useRef, useState } from "react";
import { compressImage } from "@/lib/client-image";
import { cn } from "@/lib/utils";
import { UploadIcon } from "@/components/ui/icons";

export type UploadedAsset = { id: string; key: string; renditions: number[]; width: number | null; height: number | null; alt: string | null; url: string };

type Upload = { id: number; name: string; progress: number; error?: string };

function uploadOne(file: File, purpose: string, onProgress: (p: number) => void): Promise<UploadedAsset> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/uploads");
    xhr.responseType = "json";
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300 && xhr.response?.asset) resolve(xhr.response.asset as UploadedAsset);
      else reject(new Error(xhr.response?.error ?? `Upload failed (${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error("Network error — check your connection and try again."));
    const body = new FormData();
    body.append("file", file, file.name);
    body.append("purpose", purpose);
    xhr.send(body);
  });
}

/**
 * Drag-and-drop or pick images. Photos are resized in the browser, uploaded
 * with a progress bar, then validated and converted on the server.
 */
export function ImageUploader({
  purpose,
  multiple = true,
  onUploaded,
  label = "Add images",
  compact,
}: {
  purpose: "products" | "content" | "categories" | "branding";
  multiple?: boolean;
  onUploaded: (asset: UploadedAsset) => void;
  label?: string;
  compact?: boolean;
}) {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const counter = useRef(0);

  async function handleFiles(list: FileList | File[]) {
    const files = Array.from(list).slice(0, multiple ? 20 : 1);
    for (const original of files) {
      counter.current += 1;
      const id = counter.current;
      setUploads((u) => [...u, { id, name: original.name, progress: 0 }]);
      const update = (patch: Partial<Upload>) => setUploads((u) => u.map((item) => (item.id === id ? { ...item, ...patch } : item)));
      if (!original.type.startsWith("image/") && !/\.(heic|heif)$/i.test(original.name)) {
        update({ error: "Not an image file." });
        continue;
      }
      if (/svg/i.test(original.type)) {
        update({ error: "SVG files aren't accepted. Use JPEG, PNG or WebP." });
        continue;
      }
      try {
        const file = await compressImage(original, 2400, 0.9);
        const asset = await uploadOne(file, purpose, (progress) => update({ progress }));
        update({ progress: 100 });
        onUploaded(asset);
      } catch (error) {
        update({ error: error instanceof Error ? error.message : "Upload failed." });
      }
    }
    setTimeout(() => setUploads((u) => u.filter((item) => item.error)), 2500);
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (event.dataTransfer.files.length) void handleFiles(event.dataTransfer.files);
        }}
        className={cn(
          "flex items-center justify-center rounded-2xl border border-dashed text-sm transition-colors",
          compact ? "px-4 py-4" : "px-6 py-8",
          dragging ? "border-olive bg-olive-soft" : "border-line-strong bg-white/60",
        )}
      >
        <button type="button" onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-2 rounded-full px-4 py-2 font-medium text-ink hover:bg-ink/5">
          <UploadIcon size={18} /> {label}
        </button>
        <span className="hidden text-ink-soft sm:inline">or drop {multiple ? "files" : "a file"} here</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple={multiple}
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => {
            if (event.target.files?.length) void handleFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>
      {uploads.length ? (
        <ul className="space-y-1.5" aria-live="polite">
          {uploads.map((upload) => (
            <li key={upload.id} className="text-sm">
              <div className="flex justify-between gap-3">
                <span className="truncate">{upload.name}</span>
                <span className={upload.error ? "text-wine" : "text-ink-soft"}>{upload.error ?? (upload.progress >= 100 ? "Processing done" : `${upload.progress}%`)}</span>
              </div>
              {!upload.error ? (
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={upload.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Uploading ${upload.name}`}>
                  <div className="h-full rounded-full bg-olive transition-[width]" style={{ width: `${upload.progress}%` }} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
