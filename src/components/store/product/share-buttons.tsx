"use client";

import { useState } from "react";
import { CheckIcon, FacebookIcon, LinkIcon, ShareIcon, WhatsAppIcon } from "@/components/ui/icons";

export function ShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const item = "inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-soft ring-1 ring-line hover:text-ink hover:ring-ink/40";

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        /* dismissed */
      }
    }
    await copy();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="mr-1 text-sm text-ink-soft">Share</span>
      <button type="button" onClick={share} className={item} aria-label="Share">
        <ShareIcon size={18} />
      </button>
      <a href={`https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`} target="_blank" rel="noopener noreferrer" className={item} aria-label="Share on WhatsApp">
        <WhatsAppIcon size={18} />
      </a>
      <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" className={item} aria-label="Share on Facebook">
        <FacebookIcon size={18} />
      </a>
      <button type="button" onClick={copy} className={item} aria-label={copied ? "Link copied" : "Copy link"}>
        {copied ? <CheckIcon size={18} /> : <LinkIcon size={18} />}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? "Link copied" : ""}
      </span>
    </div>
  );
}
