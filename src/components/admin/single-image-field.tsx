"use client";

import { useState } from "react";
import { ImageUploader } from "./image-uploader";

/** One image picker that stores the uploaded asset id in a hidden input. */
export function SingleImageField({ name, label, initialUrl, initialId, purpose }: { name: string; label: string; initialUrl?: string | null; initialId?: string | null; purpose: "categories" | "content" | "branding" }) {
  const [image, setImage] = useState<{ id: string; url: string } | null>(initialId && initialUrl ? { id: initialId, url: initialUrl } : null);
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <input type="hidden" name={name} value={image?.id ?? ""} />
      {image ? (
        <div className="flex items-end gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.url} alt="" className="h-28 w-28 rounded-lg object-cover" />
          <button type="button" onClick={() => setImage(null)} className="text-sm text-wine underline underline-offset-4">
            Remove image
          </button>
        </div>
      ) : null}
      <ImageUploader purpose={purpose} multiple={false} compact label={image ? "Replace image" : "Upload image"} onUploaded={(asset) => setImage({ id: asset.id, url: asset.url })} />
    </div>
  );
}
