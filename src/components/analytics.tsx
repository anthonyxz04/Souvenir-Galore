import Script from "next/script";
import { ConsentBanner } from "./consent-banner";

/**
 * Optional analytics, configured with environment variables.
 *  - Plausible is cookie-free: loaded directly.
 *  - Google Analytics uses cookies: loaded only after the visitor accepts
 *    in the consent banner (see consent-banner.tsx).
 */
export function Analytics({ nonce }: { nonce?: string }) {
  const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  const plausibleSrc = process.env.NEXT_PUBLIC_PLAUSIBLE_SRC || "https://plausible.io/js/script.js";
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  return (
    <>
      {plausibleDomain ? <Script src={plausibleSrc} data-domain={plausibleDomain} strategy="afterInteractive" nonce={nonce} /> : null}
      {gaId ? <ConsentBanner gaId={gaId} nonce={nonce} /> : null}
    </>
  );
}
