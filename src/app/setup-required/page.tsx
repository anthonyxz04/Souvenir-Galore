import type { Metadata } from "next";
import { SealMark } from "@/components/store/logo";

export const metadata: Metadata = { title: { absolute: "Souvenir Galore" }, robots: { index: false, follow: false } };

/**
 * Shown on every page of a Netlify deploy that was built before the required
 * settings existed (see BUILD_SETUP_MISSING in next.config.ts and src/proxy.ts).
 * Uses no database, so it always works.
 */
export default function SetupRequiredPage() {
  const missing = (process.env.BUILD_SETUP_MISSING || "").split(",").filter(Boolean);
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 px-6 py-16">
      <div className="flex items-center gap-3">
        <SealMark size={44} />
        <span className="font-display text-2xl">Souvenir Galore</span>
      </div>
      <h1 className="font-display text-[2.25rem] leading-tight">Our shop is almost ready</h1>
      <p className="text-[1.0625rem] text-ink-soft">We&apos;re finishing setting up. Please check back soon.</p>
      <section aria-labelledby="owner-heading" className="space-y-3 rounded-2xl bg-plaster p-5 ring-1 ring-line">
        <h2 id="owner-heading" className="font-medium">
          For the store owner
        </h2>
        <p className="text-[0.9375rem] text-ink-soft">This deploy was built before these settings were added:</p>
        <ul className="list-disc space-y-1 pl-5 text-[0.9375rem]">
          {missing.map((name) => (
            <li key={name}>
              <code>{name}</code>
            </li>
          ))}
        </ul>
        <p className="text-[0.9375rem] text-ink-soft">
          Add them in Netlify under <strong>Project configuration → Environment variables</strong>, then redeploy with{" "}
          <strong>Deploys → Trigger deploy</strong>. The step-by-step guide is in <code>docs/NETLIFY.md</code>.
        </p>
      </section>
    </main>
  );
}
