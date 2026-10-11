import type { Metadata } from "next";
import ReactMarkdown from "react-markdown";
import { prisma } from "@/lib/db";
import { markdownToPlainText } from "@/lib/text";
import { JsonLd } from "@/components/json-ld";
import { Container, EmptyState, PageHeading } from "@/components/ui/misc";
import { ChevronDownIcon } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Frequently asked questions", alternates: { canonical: "/faq" } };

export default async function FaqPage() {
  const items = await prisma.faqItem.findMany({ where: { isPublished: true }, orderBy: [{ category: "asc" }, { position: "asc" }] });
  const groups = new Map<string, typeof items>();
  for (const item of items) {
    const key = item.category || "General";
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return (
    <Container className="py-10 sm:py-16">
      {items.length ? (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: items.map((item) => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: markdownToPlainText(item.answer) } })),
          }}
        />
      ) : null}
      <PageHeading title="Questions" description="Ordering, personalization, delivery and care." />
      {items.length ? (
        <div className="mt-10 max-w-3xl space-y-10">
          {[...groups.entries()].map(([category, entries]) => (
            <section key={category} aria-label={category} className="space-y-3">
              {groups.size > 1 ? <h2 className="font-display text-2xl">{category}</h2> : null}
              <div className="divide-y divide-line border-y border-line">
                {entries.map((item) => (
                  <details key={item.id} className="group">
                    <summary className="flex items-center justify-between gap-4 py-4 text-left text-[1.0625rem] font-medium">
                      {item.question}
                      <ChevronDownIcon size={18} className="shrink-0 text-ink-soft transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="prose-sg pb-5 text-ink-soft">
                      <ReactMarkdown skipHtml>{item.answer}</ReactMarkdown>
                    </div>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState title="No questions answered yet" className="mt-10">
          Send us a message and we&apos;ll be glad to help.
        </EmptyState>
      )}
    </Container>
  );
}
