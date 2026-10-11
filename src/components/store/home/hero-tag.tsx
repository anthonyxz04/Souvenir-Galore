"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";

const STORAGE_KEY = "sg-name";
const MAX = 16;

/**
 * The hero's signature moment: a kraft gift tag that writes whatever name the
 * visitor types, in the same lettering we use on personalized pieces. The name
 * is remembered for this visit and pre-fills personalization on product pages.
 */
export function HeroTag({ defaultName = "Maya", className }: { defaultName?: string; className?: string }) {
  const [name, setName] = useState("");
  const inputId = useId();

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(STORAGE_KEY);
      if (saved) setName(saved.slice(0, MAX));
    } catch {
      /* storage unavailable */
    }
  }, []);

  function update(value: string) {
    const next = value.replace(/[\u0000-\u001f]/g, "").slice(0, MAX);
    setName(next);
    try {
      if (next.trim()) window.sessionStorage.setItem(STORAGE_KEY, next.trim());
      else window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage unavailable */
    }
  }

  const shown = name.trim() || defaultName;

  return (
    <div className={className}>
      <div className="relative">
        {/* string */}
        <svg aria-hidden viewBox="0 0 120 60" className="absolute -left-14 -top-6 h-14 w-28 text-ink/50" fill="none">
          <path d="M2 4c30 4 58 18 96 44" stroke="currentColor" strokeWidth="1.2" strokeDasharray="0" />
        </svg>
        <div className="gift-tag relative flex h-[7.5rem] w-[15.5rem] items-center pl-12 pr-6 shadow-[0_10px_30px_-12px_rgb(43_39_36/0.45)] sm:h-32 sm:w-[17rem]">
          <div className="min-w-0">
            <p className="text-xs text-ink/70">Made for</p>
            <p className="truncate font-display text-[2.1rem] leading-tight text-ink sm:text-[2.35rem]" aria-live="polite">
              {shown.split("").map((char, index) => (
                <span key={`${index}-${char}`} className="inline-block animate-letter-in whitespace-pre" style={{ animationDelay: `${Math.min(index, 8) * 18}ms` }}>
                  {char}
                </span>
              ))}
            </p>
          </div>
        </div>
      </div>
      <div className="mt-4 w-[15.5rem] sm:w-[17rem]">
        <label htmlFor={inputId} className="text-sm font-medium text-ink">
          Try a name
        </label>
        <input
          id={inputId}
          type="text"
          value={name}
          onChange={(event) => update(event.target.value)}
          maxLength={MAX}
          placeholder={defaultName}
          autoComplete="off"
          className="mt-1.5 h-11 w-full rounded-full border border-line-strong/70 bg-plaster px-4 text-[0.9375rem] focus:border-olive focus:outline-none"
        />
        <Link href="/shop?personalizable=1" className="mt-2 inline-block text-sm text-olive underline underline-offset-4 hover:text-olive-deep">
          See pieces we can personalize
        </Link>
      </div>
    </div>
  );
}
