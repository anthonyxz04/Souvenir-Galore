import Link from "next/link";
import type { HomeSectionEntry } from "@/lib/content/home";
import type { CurrencyConfig } from "@/lib/money";
import { safeHref } from "@/lib/text";
import { ButtonLink } from "@/components/ui/button";
import { Container, Stars } from "@/components/ui/misc";
import { InstagramIcon } from "@/components/ui/icons";
import { ImagePlaceholder, ResponsiveImage } from "@/components/ui/responsive-image";
import { ProductGrid } from "../product-card";
import { NewsletterForm } from "../newsletter-form";
import { HeroTag } from "./hero-tag";

type Ctx = { base: string; currency: CurrencyConfig; instagram: string; newsletter: { enabled: boolean; heading: string; body: string; consentText: string } };

function SectionHeader({ title, subtitle, href, linkLabel }: { title?: string | null; subtitle?: string | null; href?: string | null; linkLabel?: string | null }) {
  if (!title && !subtitle) return null;
  const link = safeHref(href);
  return (
    <div className="mb-8 flex flex-col gap-3 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl space-y-2">
        {title ? <h2 className="font-display text-[2rem] leading-[1.1] text-ink sm:text-title">{title}</h2> : null}
        {subtitle ? <p className="text-[1.0625rem] text-ink-soft">{subtitle}</p> : null}
      </div>
      {link ? (
        <Link href={link} className="shrink-0 text-[0.9375rem] text-olive underline underline-offset-4 hover:text-olive-deep">
          {linkLabel || "View all"}
        </Link>
      ) : null}
    </div>
  );
}

function CandleIllustration() {
  return (
    <svg viewBox="0 0 400 500" className="h-full w-full" role="img" aria-label="Illustration of a handmade concrete candle">
      <rect width="400" height="500" fill="#e4dccf" />
      <ellipse cx="200" cy="420" rx="130" ry="18" fill="#d6ccbd" />
      <path d="M98 230h204l-12 186c-1 8-8 14-16 14H126c-8 0-15-6-16-14z" fill="#b9b3aa" />
      <path d="M98 230h204l-2 26H100z" fill="#a8a29a" />
      <ellipse cx="200" cy="230" rx="102" ry="16" fill="#cfc8bd" />
      <ellipse cx="200" cy="232" rx="90" ry="12" fill="#f3ead8" />
      <path d="M200 232v-34" stroke="#2b2724" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M200 198c14-12 15-30 0-52-15 22-14 40 0 52Z" fill="#c08a2d" />
      <path d="M200 192c6-6 7-15 0-25-7 10-6 19 0 25Z" fill="#f1e2c4" />
      <g fill="#b0aaa1" opacity=".7">
        <circle cx="140" cy="300" r="2" />
        <circle cx="255" cy="340" r="1.6" />
        <circle cx="180" cy="380" r="1.8" />
        <circle cx="232" cy="285" r="1.2" />
      </g>
    </svg>
  );
}

export function HeroSection({ entry, ctx }: { entry: HomeSectionEntry; ctx: Ctx }) {
  const { section } = entry;
  const primary = safeHref(section.ctaHref) ?? "/shop";
  const secondary = safeHref(section.secondaryCtaHref);
  return (
    <section className="relative overflow-hidden">
      <Container wide className="grid items-center gap-10 py-10 sm:py-14 lg:grid-cols-12 lg:gap-8 lg:py-20">
        <div className="space-y-7 lg:col-span-6 xl:col-span-5">
          <h1 className="font-display text-[2.75rem] leading-[1.04] text-ink sm:text-display-lg xl:text-display-xl">
            {section.title || "Made by hand in Lebanon"}
          </h1>
          {section.subtitle ? <p className="max-w-xl text-lg leading-relaxed text-ink-soft sm:text-xl">{section.subtitle}</p> : null}
          <div className="flex flex-wrap gap-3">
            <ButtonLink href={primary} size="lg">
              {section.ctaLabel || "Shop the collection"}
            </ButtonLink>
            {secondary ? (
              <ButtonLink href={secondary} size="lg" variant="secondary">
                {section.secondaryCtaLabel || "Personalize a gift"}
              </ButtonLink>
            ) : null}
          </div>
        </div>
        <div className="relative lg:col-span-6 xl:col-span-7">
          <div className="relative ml-auto aspect-[4/5] w-full max-w-[34rem] overflow-hidden rounded-[var(--radius-image)] sm:aspect-[5/6] lg:aspect-[4/5]">
            {section.image ? (
              <ResponsiveImage media={section.image} base={ctx.base} alt={section.image.alt || ""} sizes="(min-width: 1024px) 45vw, 100vw" priority preferredWidth={1600} className="h-full w-full object-cover" />
            ) : (
              <CandleIllustration />
            )}
          </div>
          <HeroTag className="relative -mt-24 ml-2 sm:-mt-28 sm:ml-6 lg:absolute lg:bottom-10 lg:left-0 lg:mt-0 lg:ml-0 xl:left-6" />
        </div>
      </Container>
    </section>
  );
}

export function CategoryGridSection({ entry, ctx }: { entry: Extract<HomeSectionEntry, { kind: "categories" }>; ctx: Ctx }) {
  return (
    <section className="py-14 sm:py-20">
      <Container wide>
        <SectionHeader title={entry.section.title || "Shop by category"} subtitle={entry.section.subtitle} href={entry.section.ctaHref || "/shop"} linkLabel={entry.section.ctaLabel || "Shop all"} />
        <ul className="scrollbar-none -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-5">
          {entry.categories.map((category) => (
            <li key={category.id} className="w-[44vw] shrink-0 snap-start sm:w-auto">
              <Link href={`/category/${category.slug}`} className="group block">
                <div className="aspect-square overflow-hidden rounded-[var(--radius-image)] bg-plaster">
                  {category.image ? (
                    <ResponsiveImage media={category.image} base={ctx.base} alt="" sizes="(min-width: 1024px) 18vw, 44vw" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                  ) : (
                    <ImagePlaceholder label={category.name} />
                  )}
                </div>
                <p className="mt-3 font-display text-xl text-ink group-hover:underline group-hover:underline-offset-4">{category.name}</p>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

export function ProductGridSection({ entry, ctx }: { entry: Extract<HomeSectionEntry, { kind: "products" }>; ctx: Ctx }) {
  return (
    <section className="py-14 sm:py-20">
      <Container wide>
        <SectionHeader title={entry.section.title} subtitle={entry.section.subtitle} href={entry.section.ctaHref} linkLabel={entry.section.ctaLabel} />
        <ProductGrid products={entry.products} base={ctx.base} currency={ctx.currency} />
      </Container>
    </section>
  );
}

export function FeaturedCollectionsSection({ entry, ctx }: { entry: Extract<HomeSectionEntry, { kind: "collections" }>; ctx: Ctx }) {
  const [lead, ...rest] = entry.collections;
  const imageFor = (c: (typeof entry.collections)[number]) => c.image ?? c.products[0]?.product.images[0]?.asset ?? null;
  return (
    <section className="py-14 sm:py-20">
      <Container wide>
        <SectionHeader title={entry.section.title || "Collections"} subtitle={entry.section.subtitle} href="/collections" linkLabel="All collections" />
        <div className={rest.length ? "grid gap-6 lg:grid-cols-2" : "grid"}>
          <Link href={`/collections/${lead.slug}`} className="group relative block overflow-hidden rounded-[var(--radius-image)] bg-plaster">
            <div className="aspect-[4/3] lg:aspect-[5/6]">
              {imageFor(lead) ? (
                <ResponsiveImage media={imageFor(lead)!} base={ctx.base} alt="" sizes="(min-width: 1024px) 48vw, 100vw" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]" />
              ) : (
                <ImagePlaceholder />
              )}
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/70 to-transparent p-6 pt-24 text-white sm:p-8">
              <h3 className="font-display text-[2rem] leading-tight sm:text-title">{lead.name}</h3>
              {lead.description ? <p className="mt-2 max-w-md text-white/85">{lead.description}</p> : null}
            </div>
          </Link>
          {rest.length ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
              {rest.map((collection) => (
                <Link key={collection.id} href={`/collections/${collection.slug}`} className="group grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-center gap-5 rounded-[var(--radius-image)] bg-plaster p-3 pr-6 hover:bg-white/60">
                  <div className="aspect-square overflow-hidden rounded-[var(--radius-image)] bg-limestone-deep">
                    {imageFor(collection) ? (
                      <ResponsiveImage media={imageFor(collection)!} base={ctx.base} alt="" sizes="(min-width: 1024px) 20vw, 40vw" className="h-full w-full object-cover" />
                    ) : (
                      <ImagePlaceholder />
                    )}
                  </div>
                  <div>
                    <h3 className="font-display text-2xl leading-tight text-ink group-hover:underline group-hover:underline-offset-4">{collection.name}</h3>
                    {collection.description ? <p className="mt-2 line-clamp-3 text-[0.9375rem] text-ink-soft">{collection.description}</p> : null}
                  </div>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </Container>
    </section>
  );
}

export function PromoBannerSection({ entry, ctx }: { entry: HomeSectionEntry; ctx: Ctx }) {
  const { section } = entry;
  const href = safeHref(section.ctaHref);
  return (
    <section className="py-8 sm:py-12">
      <Container wide>
        <div className="grid overflow-hidden rounded-2xl bg-olive text-white md:grid-cols-2">
          <div className="flex flex-col justify-center gap-4 p-8 sm:p-12">
            {section.title ? <h2 className="font-display text-[2rem] leading-tight sm:text-title">{section.title}</h2> : null}
            {section.subtitle ? <p className="max-w-md text-lg text-white/85">{section.subtitle}</p> : null}
            {href ? (
              <div>
                <ButtonLink href={href} variant="wax" size="lg">
                  {section.ctaLabel || "Shop now"}
                </ButtonLink>
              </div>
            ) : null}
          </div>
          {section.image ? (
            <div className="aspect-[16/10] md:aspect-auto">
              <ResponsiveImage media={section.image} base={ctx.base} alt={section.image.alt || ""} sizes="(min-width: 768px) 50vw, 100vw" className="h-full w-full object-cover" />
            </div>
          ) : null}
        </div>
      </Container>
    </section>
  );
}

export function CraftsmanshipSection({ entry, ctx }: { entry: HomeSectionEntry; ctx: Ctx }) {
  const { section } = entry;
  const href = safeHref(section.ctaHref);
  return (
    <section className="py-14 sm:py-24">
      <Container wide className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="aspect-[4/3] overflow-hidden rounded-[var(--radius-image)] bg-plaster lg:aspect-[5/4]">
          {section.image ? (
            <ResponsiveImage media={section.image} base={ctx.base} alt={section.image.alt || ""} sizes="(min-width: 1024px) 50vw, 100vw" className="h-full w-full object-cover" />
          ) : (
            <CandleIllustration />
          )}
        </div>
        <div className="max-w-xl space-y-5">
          {section.title ? <h2 className="font-display text-[2rem] leading-[1.1] sm:text-title">{section.title}</h2> : null}
          {section.subtitle ? <p className="text-xl leading-relaxed text-ink">{section.subtitle}</p> : null}
          {section.body ? <p className="whitespace-pre-line text-[1.0625rem] leading-relaxed text-ink-soft">{section.body}</p> : null}
          {entry.section.items.length ? (
            <ul className="space-y-3 border-t border-line pt-5">
              {entry.section.items.map((item) => (
                <li key={item.id}>
                  <p className="font-medium text-ink">{item.title}</p>
                  {item.body ? <p className="text-[0.9375rem] text-ink-soft">{item.body}</p> : null}
                </li>
              ))}
            </ul>
          ) : null}
          {href ? (
            <ButtonLink href={href} variant="secondary">
              {section.ctaLabel || "Our story"}
            </ButtonLink>
          ) : null}
        </div>
      </Container>
    </section>
  );
}

export function PersonalizationStepsSection({ entry }: { entry: HomeSectionEntry }) {
  const { section } = entry;
  const href = safeHref(section.ctaHref);
  if (section.items.length === 0) return null;
  return (
    <section className="bg-plaster py-16 sm:py-24">
      <Container wide>
        <SectionHeader title={section.title || "How personalization works"} subtitle={section.subtitle} />
        <ol className="grid gap-8 md:grid-cols-3 md:gap-10">
          {section.items.map((item, index) => (
            <li key={item.id} className="relative border-t border-ink/20 pt-6">
              <span className="font-display text-5xl leading-none text-wax" aria-hidden>
                {index + 1}
              </span>
              <h3 className="mt-4 font-display text-2xl text-ink">{item.title}</h3>
              {item.body ? <p className="mt-2 text-[1.0625rem] leading-relaxed text-ink-soft">{item.body}</p> : null}
            </li>
          ))}
        </ol>
        {href ? (
          <div className="mt-10">
            <ButtonLink href={href}>{section.ctaLabel || "Start a custom order"}</ButtonLink>
          </div>
        ) : null}
      </Container>
    </section>
  );
}

export function TestimonialsSection({ entry }: { entry: Extract<HomeSectionEntry, { kind: "testimonials" }> }) {
  return (
    <section className="py-14 sm:py-20">
      <Container wide>
        <SectionHeader title={entry.section.title || "From our customers"} subtitle={entry.section.subtitle} />
        <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {entry.reviews.map((review) => (
            <li key={review.id}>
              <figure className="flex h-full flex-col justify-between gap-6 rounded-2xl bg-plaster p-6 sm:p-7">
                <blockquote className="space-y-3">
                  <Stars rating={review.rating} />
                  {review.title ? <p className="font-display text-xl text-ink">{review.title}</p> : null}
                  <p className="text-[1.0625rem] leading-relaxed text-ink">{review.body}</p>
                </blockquote>
                <figcaption className="text-sm text-ink-soft">
                  {review.authorName}
                  {review.verifiedPurchase ? " — verified purchase" : ""}
                  {review.product ? (
                    <>
                      <br />
                      <Link href={`/products/${review.product.slug}`} className="underline underline-offset-4 hover:text-ink">
                        {review.product.name}
                      </Link>
                    </>
                  ) : null}
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

export function InstagramSection({ entry, ctx }: { entry: HomeSectionEntry; ctx: Ctx }) {
  const { section } = entry;
  const profile = ctx.instagram ? `https://instagram.com/${ctx.instagram}` : null;
  const items = section.items.filter((item) => item.image);
  if (!profile && items.length === 0) return null;
  return (
    <section className="py-14 sm:py-20">
      <Container wide>
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl space-y-2">
            <h2 className="font-display text-[2rem] leading-[1.1] sm:text-title">{section.title || "Follow the workshop"}</h2>
            {section.subtitle ? <p className="text-[1.0625rem] text-ink-soft">{section.subtitle}</p> : null}
          </div>
          {profile ? (
            <a href={profile} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-[0.9375rem] text-olive underline underline-offset-4">
              <InstagramIcon size={18} /> @{ctx.instagram}
            </a>
          ) : null}
        </div>
        {items.length ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {items.slice(0, 6).map((item) => {
              const href = safeHref(item.href) ?? profile;
              const image = (
                <ResponsiveImage media={item.image!} base={ctx.base} alt={item.title || item.image!.alt || "Instagram post"} sizes="(min-width: 1024px) 16vw, 50vw" className="aspect-square h-full w-full object-cover transition-opacity hover:opacity-90" />
              );
              return (
                <li key={item.id} className="overflow-hidden rounded-[var(--radius-image)] bg-plaster">
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer">
                      {image}
                    </a>
                  ) : (
                    image
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}
      </Container>
    </section>
  );
}

export function NewsletterSection({ entry, ctx }: { entry: HomeSectionEntry; ctx: Ctx }) {
  if (!ctx.newsletter.enabled) return null;
  return (
    <section className="py-14 sm:py-20">
      <Container wide>
        <div className="grid gap-8 rounded-2xl bg-limestone-deep/70 p-8 sm:p-12 lg:grid-cols-2 lg:items-center">
          <div className="space-y-3">
            <h2 className="font-display text-[2rem] leading-[1.1] sm:text-title">{entry.section.title || ctx.newsletter.heading}</h2>
            <p className="max-w-md text-[1.0625rem] text-ink-soft">{entry.section.subtitle || ctx.newsletter.body}</p>
          </div>
          <NewsletterForm consentText={ctx.newsletter.consentText} source="homepage" />
        </div>
      </Container>
    </section>
  );
}

export function BasicSection({ entry }: { entry: HomeSectionEntry }) {
  const { section } = entry;
  if (!section.title && !section.body) return null;
  return (
    <section className="py-14">
      <Container>
        <SectionHeader title={section.title} subtitle={section.subtitle} />
        {section.body ? <p className="max-w-2xl whitespace-pre-line text-ink-soft">{section.body}</p> : null}
      </Container>
    </section>
  );
}
