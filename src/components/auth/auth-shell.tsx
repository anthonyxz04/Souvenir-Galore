import type { ReactNode } from "react";
import { Container } from "@/components/ui/misc";

export function AuthShell({ title, intro, children, aside }: { title: string; intro?: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <Container className="py-12 sm:py-20">
      <div className="mx-auto grid max-w-4xl gap-12 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="font-display text-[2.25rem] leading-tight sm:text-title">{title}</h1>
            {intro ? <div className="text-ink-soft">{intro}</div> : null}
          </div>
          {children}
        </div>
        {aside ? <aside className="h-fit rounded-2xl bg-plaster p-6 text-[0.9375rem] leading-relaxed text-ink-soft sm:p-8">{aside}</aside> : null}
      </div>
    </Container>
  );
}
