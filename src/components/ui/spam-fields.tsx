"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

/**
 * Hidden anti-spam fields for public forms: a honeypot that people never see,
 * the time the form was rendered, and Cloudflare Turnstile when configured.
 */
export function SpamFields({ nonce }: { nonce?: string }) {
  const [renderedAt, setRenderedAt] = useState("");
  useEffect(() => setRenderedAt(String(Date.now())), []);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  return (
    <>
      <div aria-hidden className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden">
        <label>
          Leave this field empty
          <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      <input type="hidden" name="_rendered" value={renderedAt} />
      {siteKey ? (
        <>
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer nonce={nonce} />
          <div className="cf-turnstile" data-sitekey={siteKey} data-theme="light" />
        </>
      ) : null}
    </>
  );
}
