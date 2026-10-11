"use client";

import { useEffect } from "react";
import { Container } from "@/components/ui/misc";

export default function StoreError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <Container className="py-20 sm:py-28">
      <div className="mx-auto max-w-xl space-y-5 text-center">
        <h1 className="font-display text-title">Something went wrong</h1>
        <p className="text-ink-soft">The page couldn&apos;t load. Please try again — if it keeps happening, contact us and mention the time it happened.</p>
        {error.digest ? <p className="text-xs text-ink-soft">Reference: {error.digest}</p> : null}
        <button type="button" onClick={reset} className="inline-flex h-11 items-center rounded-full bg-olive px-5 font-medium text-white hover:bg-olive-deep">
          Try again
        </button>
      </div>
    </Container>
  );
}
