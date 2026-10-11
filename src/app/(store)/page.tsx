import type { Metadata } from "next";
import { getHomeSections } from "@/lib/content/home";
import { getAllSettings, getCurrency } from "@/lib/settings";
import { publicMediaBase } from "@/lib/storage";
import { absoluteUrl } from "@/lib/env";
import { JsonLd } from "@/components/json-ld";
import {
  BasicSection,
  CategoryGridSection,
  CraftsmanshipSection,
  FeaturedCollectionsSection,
  HeroSection,
  InstagramSection,
  NewsletterSection,
  PersonalizationStepsSection,
  ProductGridSection,
  PromoBannerSection,
  TestimonialsSection,
} from "@/components/store/home/sections";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { seo, store } = await getAllSettings();
  return { title: { absolute: seo.defaultTitle || store.name }, alternates: { canonical: "/" } };
}

export default async function HomePage() {
  const [sections, settings, currency] = await Promise.all([getHomeSections(), getAllSettings(), getCurrency()]);
  const ctx = { base: publicMediaBase(), currency, instagram: settings.contact.instagram, newsletter: settings.newsletter };

  const sameAs = [
    settings.contact.instagram ? `https://instagram.com/${settings.contact.instagram}` : null,
    settings.contact.facebookUrl || null,
    settings.contact.tiktokUrl || null,
  ].filter(Boolean);

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Store",
          name: settings.store.name,
          description: settings.store.description,
          url: absoluteUrl("/"),
          ...(settings.contact.email ? { email: settings.contact.email } : {}),
          ...(settings.contact.phone ? { telephone: settings.contact.phone } : {}),
          ...(sameAs.length ? { sameAs } : {}),
          address: { "@type": "PostalAddress", addressCountry: "LB" },
        }}
      />
      {sections.length === 0 ? <HeroSection entry={{ kind: "basic", section: placeholderHero() }} ctx={ctx} /> : null}
      {sections.map((entry) => {
        const key = entry.section.id;
        switch (entry.kind) {
          case "products":
            return <ProductGridSection key={key} entry={entry} ctx={ctx} />;
          case "categories":
            return <CategoryGridSection key={key} entry={entry} ctx={ctx} />;
          case "collections":
            return <FeaturedCollectionsSection key={key} entry={entry} ctx={ctx} />;
          case "testimonials":
            return <TestimonialsSection key={key} entry={entry} />;
          case "instagram":
            return <InstagramSection key={key} entry={entry} ctx={ctx} />;
          default:
            switch (entry.section.type) {
              case "HERO":
                return <HeroSection key={key} entry={entry} ctx={ctx} />;
              case "PROMO_BANNER":
                return <PromoBannerSection key={key} entry={entry} ctx={ctx} />;
              case "CRAFTSMANSHIP":
                return <CraftsmanshipSection key={key} entry={entry} ctx={ctx} />;
              case "PERSONALIZATION_STEPS":
                return <PersonalizationStepsSection key={key} entry={entry} />;
              case "NEWSLETTER":
                return <NewsletterSection key={key} entry={entry} ctx={ctx} />;
              default:
                return <BasicSection key={key} entry={entry} />;
            }
        }
      })}
    </>
  );
}

/** Shown only if every homepage section has been removed in the admin. */
function placeholderHero() {
  return {
    id: "placeholder",
    type: "HERO" as const,
    title: "Made by hand in Lebanon",
    subtitle: "Candles, keepsakes and personalized gifts.",
    body: null,
    ctaLabel: "Shop the collection",
    ctaHref: "/shop",
    secondaryCtaLabel: null,
    secondaryCtaHref: null,
    imageId: null,
    image: null,
    config: {},
    position: 0,
    isVisible: true,
    startsAt: null,
    endsAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [],
  };
}
