"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { addDemoProductAction } from "@/server/actions/admin/products";
import { buttonClass } from "@/components/ui/button";

/**
 * Adds the sample products one by one (each is a short server request), with
 * progress, then refreshes the dashboard.
 */
export function AddDemoCatalogButton({ count }: { count: number }) {
  const router = useRouter();
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    for (let index = 0; index < count; index += 1) {
      setProgress(index + 1);
      const result = await addDemoProductAction(index);
      if (result.status === "error") {
        setError(result.message ?? "Something went wrong. Nothing else was added.");
        setProgress(null);
        return;
      }
    }
    setProgress(null);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <button type="button" onClick={run} disabled={progress !== null} className={buttonClass("secondary", "sm")}>
        {progress !== null ? `Adding ${progress} of ${count}…` : "Add sample products"}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-wine">
          {error}
        </p>
      ) : null}
    </div>
  );
}
