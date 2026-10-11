import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/auth/permissions";
import { getApprovedReviews, getProductDetail, getRelatedProducts } from "@/lib/catalog/queries";
import { effectiveVariantPrice, prepTimeLabel, priceRange, productBadges, variantAvailability, availabilityLabel } from "@/lib/catalog/pricing";
import { absoluteUrl } from "@/lib/env";
import { getAllSettings } from "@/lib/settings";
import { publicMediaBase } from "@/lib/storage";
import { mediaUrl } from "@/lib/storage/urls";
import { markdownToPlainText, truncate } from "@/lib/text";
import { toMajorString } from "@/lib/money";
import { JsonLd } from "@/components/json-ld";
import { ProductBadge } from "@/components/ui/badge";
import { Breadcrumbs, Container, Stars } from "@/components/ui/misc";
import { Notice } from "@/components/ui/form-message";
import { ClockIcon, StoreIcon, TruckIcon } from "@/components/ui/icons";
import { ProductGallery } from "@/components/store/product/gallery";
import { ProductPurchase } from "@/components/store/product/purchase";
import { ProductReviews } from "@/components/store/product/reviews";
import { ShareButtons } from "@/components/store/product/share-buttons";
import { RecentlyViewed, TrackRecentlyViewed } from "@/components/store/product/recently-viewed";
import { ProductGrid } from "@/components/store/product-card";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ preview?: string }> };

async function loadProduct(slug: string, preview: boolean) {
  if (preview) {
    const user = await getCurrentUser();
    if (user && isStaffRole(user.role)) return getProductDetail(slug, true);
  }
  return getProductDetail(slug);
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { preview } = await searchParams;
  const product = await loadProduct(slug, preview === "1");
  if (!product) return { title: "Product not found" };
  const description =
    product.seoDescription || truncate(product.shortDescription || markdownToPlainText(product.description ?? "") || product.name, 160);
  const image = product.images[0]?.asset;
  const base = publicMediaBase();
  const imageUrl = image ? mediaUrl(base.startsWith("http") ? base : absoluteUrl(base), image, 1600) : undefined;
  const { store } = await getAllSettings();
  return {
    title: product.seoTitle || product.name,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title: product.name,
      description,
      type: "website",
      siteName: store.name,
      url: `/products/${product.slug}`,
      images: imageUrl ? [{ url: imageUrl, alt: product.images[0]?.alt || product.name }] : [{ url: "/og-image.png", width: 1200, height: 630, alt: store.name }],
    },
    robots: product.status !== "ACTIVE" ? { index: false, follow: false } : undefined,
  };
}

export default async function ProductPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { preview } = await searchParams;
  const product = await loadProduct(slug, preview === "1");
  if (!product) notFound();

  const [settings, user, reviews, related, zones] = await Promise.all([
    getAllSettings(),
    getCurrentUser(),
    getApprovedReviews(product.id),
    getRelatedProducts(product),
    prisma.deliveryZone.findMany({ where: { isActive: true }, select: { minDays: true, maxDays: true } }),
  ]);
  const { commerce, contact, pickup } = settings;
  const currency = { code: commerce.currencyCode, decimals: commerce.currencyDecimals, locale: commerce.currencyLocale };
  const base = publicMediaBase();
  const now = new Date();
  const isQuote = product.pricingType === "QUOTE";

  const wishlisted = user
    ? Boolean(await prisma.wishlistItem.findUnique({ where: { userId_productId: { userId: user.id, productId: product.id } }, select: { userId: true } }))
    : false;
  const canReview = user
    ? !(await prisma.review.findUnique({ where: { productId_userId: { productId: product.id, userId: user.id } }, select: { id: true } }))
    : false;

  const range = priceRange(product.variants, product, now);
  const badges = productBadges({ ...product, onSale: Boolean(range?.onSale) && !isQuote, inStock: product.inStock || isQuote }, now, commerce.newBadgeDays);

  const variants = product.variants.map((variant) => {
    const price = effectiveVariantPrice(variant, product, now);
    const availability = variantAvailability(variant, product, commerce.lowStockThreshold);
    return {
      id: variant.id,
      title: variant.title,
      options: [variant.option1, variant.option2, variant.option3].slice(0, product.options.length),
      price: price.price,
      compareAt: price.compareAt,
      available: availability.purchasable,
      maxQuantity: availability.maxQuantity === null ? commerce.maxQuantityPerLine : Math.min(availability.maxQuantity, commerce.maxQuantityPerLine, product.maxPerOrder ?? Infinity),
      stockLabel: availabilityLabel(availability.status, variant.stock),
      status: availability.status,
    };
  });

  const deliveryDays = zones.length
    ? { min: Math.min(...zones.map((z) => z.minDays ?? Infinity)), max: Math.max(...zones.map((z) => z.maxDays ?? 0)) }
    : null;
  const prep = prepTimeLabel(product.prepTimeMinDays, product.prepTimeMaxDays);
  const primaryCategory = product.categories.find((c) => c.category.isPublished)?.category;
  const trail = [
    { label: "Home", href: "/" },
    ...(primaryCategory?.parent ? [{ label: primaryCategory.parent.name, href: `/category/${primaryCategory.parent.slug}` }] : []),
    ...(primaryCategory ? [{ label: primaryCategory.name, href: `/category/${primaryCategory.slug}` }] : [{ label: "Shop", href: "/shop" }]),
    { label: product.name },
  ];

  const galleryImages = product.images.map((image) => ({ ...image.asset, alt: image.alt || image.asset.alt || product.name }));
  const productUrl = absoluteUrl(`/products/${product.slug}`);
  const imageBase = base.startsWith("http") ? base : absoluteUrl(base);

  const structured: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    url: productUrl,
    description: truncate(product.shortDescription || markdownToPlainText(product.description ?? ""), 500) || undefined,
    image: galleryImages.slice(0, 4).map((image) => mediaUrl(imageBase, image, 1600)),
    sku: product.variants[0]?.sku ?? undefined,
    brand: { "@type": "Brand", name: settings.store.name },
    ...(primaryCategory ? { category: primaryCategory.name } : {}),
  };
  if (!isQuote && range) {
    structured.offers = {
      "@type": "AggregateOffer",
      priceCurrency: currency.code,
      lowPrice: toMajorString(range.min, currency.decimals),
      highPrice: toMajorString(range.max, currency.decimals),
      offerCount: variants.length,
      availability: product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: productUrl,
    };
  }
  if (product.ratingCount > 0) {
    structured.aggregateRating = { "@type": "AggregateRating", ratingValue: product.ratingAvg.toFixed(1), reviewCount: product.ratingCount };
  }

  return (
    <>
      <JsonLd data={structured} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: trail.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.label, ...(item.href ? { item: absoluteUrl(item.href) } : {}) })),
        }}
      />
      <TrackRecentlyViewed productId={product.id} />

      <Container wide className="py-6 sm:py-10">
        {product.status !== "ACTIVE" ? (
          <Notice tone="warning" title="Preview" className="mb-6">
            This product is {product.status === "DRAFT" ? "a draft" : "archived"} and isn&apos;t visible to customers.
          </Notice>
        ) : null}
        <Breadcrumbs items={trail} />

        <div className="mt-6 grid gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-7">
            <ProductGallery images={galleryImages} base={base} productName={product.name} />
          </div>

          <div className="lg:col-span-5">
            <div className="space-y-6 lg:sticky lg:top-28">
              <div className="space-y-3">
                {badges.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {badges.map((badge) => (
                      <ProductBadge key={badge.key} kind={badge.key} label={badge.label} />
                    ))}
                  </div>
                ) : null}
                <h1 className="font-display text-[2.25rem] leading-[1.08] text-ink sm:text-title">{product.name}</h1>
                {product.ratingCount > 0 ? (
                  <a href="#reviews" className="inline-flex items-center gap-2 text-sm text-ink-soft hover:text-ink">
                    <Stars rating={product.ratingAvg} />
                    {product.ratingCount === 1 ? "1 review" : `${product.ratingCount} reviews`}
                  </a>
                ) : null}
                {product.shortDescription ? <p className="text-[1.0625rem] leading-relaxed text-ink-soft">{product.shortDescription}</p> : null}
              </div>

              <ProductPurchase
                product={{
                  id: product.id,
                  name: product.name,
                  slug: product.slug,
                  isQuote,
                  allowInquiry: product.allowInquiry,
                  options: product.options.map((o) => ({ name: o.name, values: o.values })),
                  variants,
                  personalizationFields: product.personalizationFields.map((field) => ({
                    id: field.id,
                    label: field.label,
                    type: field.type,
                    isRequired: field.isRequired,
                    maxLength: field.maxLength,
                    options: field.options,
                    priceDelta: field.priceDelta,
                    placeholder: field.placeholder,
                    helpText: field.helpText,
                  })),
                }}
                currency={currency}
                wishlisted={wishlisted}
                signedIn={Boolean(user)}
                contact={{
                  whatsapp: contact.showWhatsappButton ? contact.whatsapp : "",
                  instagram: contact.showInstagramButton ? contact.instagram : "",
                  email: contact.showEmailButton ? contact.email : "",
                }}
                productUrl={productUrl}
                secondaryCurrency={
                  commerce.secondaryCurrencyEnabled
                    ? { code: commerce.secondaryCurrencyCode, decimals: commerce.secondaryCurrencyDecimals, rate: commerce.secondaryCurrencyRate, locale: commerce.currencyLocale }
                    : null
                }
              />

              <ul className="space-y-3 border-t border-line pt-5 text-[0.9375rem] text-ink">
                {prep || product.madeToOrder ? (
                  <li className="flex gap-3">
                    <ClockIcon className="mt-0.5 shrink-0 text-ink-soft" />
                    <span>{prep ?? "Made to order"}{product.madeToOrder ? " — each piece is made after you order." : "."}</span>
                  </li>
                ) : null}
                {deliveryDays && Number.isFinite(deliveryDays.min) && deliveryDays.max > 0 ? (
                  <li className="flex gap-3">
                    <TruckIcon className="mt-0.5 shrink-0 text-ink-soft" />
                    <span>
                      Delivery across Lebanon in about {deliveryDays.min === deliveryDays.max ? deliveryDays.max : `${deliveryDays.min}–${deliveryDays.max}`} working days
                      {prep ? " once ready" : ""}.{" "}
                      <Link href="/pages/delivery-and-pickup" className="underline underline-offset-4">
                        Delivery details
                      </Link>
                    </span>
                  </li>
                ) : null}
                {pickup.enabled ? (
                  <li className="flex gap-3">
                    <StoreIcon className="mt-0.5 shrink-0 text-ink-soft" />
                    <span>Free pickup{pickup.locationName ? ` from ${pickup.locationName}` : ""}.</span>
                  </li>
                ) : null}
              </ul>

              <ShareButtons url={productUrl} title={product.name} />
            </div>
          </div>
        </div>

        {product.description ? (
          <section aria-labelledby="details-heading" className="mt-16 grid gap-6 border-t border-line pt-12 lg:grid-cols-12">
            <h2 id="details-heading" className="font-display text-subtitle lg:col-span-4">
              Details
            </h2>
            <div className="prose-sg lg:col-span-8">
              <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>
                {product.description}
              </ReactMarkdown>
            </div>
          </section>
        ) : null}

        {product.categories.length || product.collections.length ? (
          <div className="mt-10 flex flex-wrap gap-2 text-sm">
            {product.categories
              .filter((c) => c.category.isPublished)
              .map((c) => (
                <Link key={c.category.id} href={`/category/${c.category.slug}`} className="rounded-full bg-plaster px-3 py-1.5 ring-1 ring-line hover:ring-ink/40">
                  {c.category.name}
                </Link>
              ))}
            {product.collections
              .filter((c) => c.collection.isPublished)
              .map((c) => (
                <Link key={c.collection.id} href={`/collections/${c.collection.slug}`} className="rounded-full bg-plaster px-3 py-1.5 ring-1 ring-line hover:ring-ink/40">
                  {c.collection.name}
                </Link>
              ))}
          </div>
        ) : null}

        {commerce.reviewsEnabled ? (
          <ProductReviews
            productId={product.id}
            reviews={reviews}
            ratingAvg={product.ratingAvg}
            ratingCount={product.ratingCount}
            canReview={canReview}
            signedIn={Boolean(user)}
            emailVerified={Boolean(user?.emailVerifiedAt)}
            loginHref={`/login?next=${encodeURIComponent(`/products/${product.slug}#reviews`)}`}
          />
        ) : null}

        {related.length ? (
          <section aria-labelledby="related-heading" className="mt-20">
            <h2 id="related-heading" className="mb-8 font-display text-[2rem] leading-tight sm:text-title">
              You may also like
            </h2>
            <ProductGrid products={related} base={base} currency={currency} />
          </section>
        ) : null}

        <RecentlyViewed excludeId={product.id} base={base} currency={currency} />
      </Container>
    </>
  );
}
