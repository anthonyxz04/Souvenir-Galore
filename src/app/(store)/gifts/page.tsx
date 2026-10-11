import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getAllSettings } from "@/lib/settings";
import { formatMoney } from "@/lib/money";
import { Container, PageHeading } from "@/components/ui/misc";

export const metadata: Metadata = {
  title: "Gift finder",
  description: "Find a handmade gift by occasion, by who it's for, or by budget.",
  alternates: { canonical: "/gifts" },
};

const chip = "inline-flex min-h-11 items-center rounded-full bg-plaster px-5 text-[0.9375rem] ring-1 ring-line transition-colors hover:bg-white hover:ring-ink/40";

export default async function GiftFinderPage() {
  const [settings, groups] = await Promise.all([
    getAllSettings(),
    prisma.tagGroup.findMany({
      where: { slug: { in: ["occasion", "recipient"] } },
      include: {
        tags: {
          orderBy: [{ position: "asc" }, { name: "asc" }],
          where: { products: { some: { product: { status: "ACTIVE" } } } },
          select: { name: true, slug: true },
        },
      },
    }),
  ]);
  const { commerce } = settings;
  const currency = { code: commerce.currencyCode, decimals: commerce.currencyDecimals, locale: commerce.currencyLocale };
  const unit = 10 ** commerce.currencyDecimals;
  const tiers = [...commerce.budgetTiers].sort((a, b) => a - b);
  const budgets = tiers.map((tier, index) => {
    const lower = index === 0 ? null : tiers[index - 1];
    return {
      label: lower === null ? `Under ${formatMoney(tier * unit, currency)}` : `${formatMoney(lower * unit, currency)} – ${formatMoney(tier * unit, currency)}`,
      href: `/shop?${lower === null ? "" : `min=${lower}&`}max=${tier}&sort=price_asc`,
    };
  });
  if (tiers.length) budgets.push({ label: `${formatMoney(tiers[tiers.length - 1] * unit, currency)} and up`, href: `/shop?min=${tiers[tiers.length - 1]}&sort=price_asc` });

  const occasion = groups.find((g) => g.slug === "occasion");
  const recipient = groups.find((g) => g.slug === "recipient");

  return (
    <Container className="space-y-14 py-10 sm:py-16">
      <PageHeading title="Find the right gift" description="Start with the moment, the person, or what you'd like to spend. Every path leads to pieces made by hand." />

      {occasion && occasion.tags.length ? (
        <section aria-labelledby="by-occasion" className="space-y-5">
          <h2 id="by-occasion" className="font-display text-subtitle">
            By occasion
          </h2>
          <ul className="flex flex-wrap gap-2.5">
            {occasion.tags.map((tag) => (
              <li key={tag.slug}>
                <Link href={`/shop?occasion=${tag.slug}`} className={chip}>
                  {tag.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {recipient && recipient.tags.length ? (
        <section aria-labelledby="by-recipient" className="space-y-5">
          <h2 id="by-recipient" className="font-display text-subtitle">
            For someone special
          </h2>
          <ul className="flex flex-wrap gap-2.5">
            {recipient.tags.map((tag) => (
              <li key={tag.slug}>
                <Link href={`/shop?recipient=${tag.slug}`} className={chip}>
                  {tag.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="by-budget" className="space-y-5">
        <h2 id="by-budget" className="font-display text-subtitle">
          By budget
        </h2>
        <ul className="flex flex-wrap gap-2.5">
          {budgets.map((budget) => (
            <li key={budget.href}>
              <Link href={budget.href} className={chip}>
                {budget.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl bg-olive p-8 text-white sm:p-10">
        <h2 className="font-display text-subtitle">Can&apos;t find it?</h2>
        <p className="mt-2 max-w-xl text-white/85">Most of what we make can be adapted — colors, scents, names, quantities for an event. Tell us what you have in mind.</p>
        <Link href="/custom-order" className="mt-5 inline-flex h-11 items-center rounded-full bg-wax px-5 font-medium text-ink hover:bg-[#b07d24]">
          Request a custom piece
        </Link>
      </section>
    </Container>
  );
}
