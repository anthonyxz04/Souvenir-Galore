"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import Link from "next/link";

const STORAGE_KEY = "sg-analytics-consent";

function readConsent(): "granted" | "denied" | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

/** Asks before loading Google Analytics (which sets cookies). */
export function ConsentBanner({ gaId, nonce }: { gaId: string; nonce?: string }) {
  const [consent, setConsent] = useState<"granted" | "denied" | null | "unknown">("unknown");

  useEffect(() => setConsent(readConsent()), []);

  function choose(value: "granted" | "denied") {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* storage unavailable — choice applies to this visit only */
    }
    setConsent(value);
  }

  return (
    <>
      {consent === "granted" ? (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`} strategy="afterInteractive" nonce={nonce} />
          <Script id="ga-init" strategy="afterInteractive" nonce={nonce}>
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config',${JSON.stringify(gaId)},{anonymize_ip:true});`}
          </Script>
        </>
      ) : null}
      {consent === null ? (
        <div role="dialog" aria-label="Cookie preferences" className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-xl rounded-2xl bg-ink p-4 text-sm text-white shadow-lift sm:p-5">
          <p>
            We'd like to use analytics cookies to understand how the shop is used. They're optional.{" "}
            <Link href="/pages/privacy-policy" className="underline underline-offset-2">
              Privacy policy
            </Link>
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => choose("granted")} className="h-10 rounded-full bg-white px-4 font-medium text-ink">
              Allow analytics
            </button>
            <button type="button" onClick={() => choose("denied")} className="h-10 rounded-full px-4 font-medium text-white ring-1 ring-white/40">
              No thanks
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
