import Link from "next/link";
import type { ProductCardData } from "@/lib/catalog/queries";
import { formatMoney, type CurrencyConfig } from "@/lib/money";
import { cn } from "@/lib/utils";
import { ProductBadge } from "@/components/ui/badge";
import { PenIcon } from "@/components/ui/icons";
import { ImagePlaceholder, ResponsiveImage } from "@/components/ui/responsive-image";

export function PriceTag({ product, currency, className }: { product: Pick<ProductCardData, "price" | "isQuote">; currency: CurrencyConfig; className?: string }) {
  if (product.isQuote) return <span className={cn("text-ink-soft", className)}>Price on request</span>;
  if (!product.price) return null;
  const { min, max, onSale, compareAtMin } = product.price;
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-2", className)}>
      <span className={onSale ? "text-wine" : undefined}>
        {min !== max ? "From " : ""}
        {formatMoney(min, currency)}
      </span>
      {onSale && compareAtMin ? (
        <s className="text-sm text-ink-soft">
          <span className="sr-only">Regular price </span>
          {formatMoney(compareAtMin, currency)}
        </s>
      ) : null}
    </span>
  );
}

export function ProductCard({
  product,
  base,
  currency,
  priority,
  sizes = "(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 46vw",
}: {
  product: ProductCardData;
  base: string;
  currency: CurrencyConfig;
  priority?: boolean;
  sizes?: string;
}) {
  const badges = product.badges.filter((b) => b.key !== "new" || product.badges.length === 1).slice(0, 2);
  return (
    <article className="group relative flex flex-col rounded-lg has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-4 has-[a:focus-visible]:outline-olive">
      <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-image)] bg-plaster">
        {product.image ? (
          <>
            <ResponsiveImage
              media={product.image}
              base={base}
              alt={product.image.alt}
              sizes={sizes}
              priority={priority}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            />
            {product.hoverImage ? (
              <ResponsiveImage
                media={product.hoverImage}
                base={base}
                alt=""
                sizes={sizes}
                className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              />
            ) : null}
          </>
        ) : (
          <ImagePlaceholder label={product.name} />
        )}
        {badges.length ? (
          <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
            {badges.map((badge) => (
              <ProductBadge key={badge.key} kind={badge.key} label={badge.label} />
            ))}
          </div>
        ) : null}
      </div>
      <div className="mt-3 space-y-1">
        <h3 className="text-[0.9375rem] font-medium leading-snug text-ink sm:text-base">
          <Link href={`/products/${product.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {product.name}
          </Link>
        </h3>
        <PriceTag product={product} currency={currency} className="text-[0.9375rem] text-ink" />
        {product.personalizable ? (
          <p className="inline-flex items-center gap-1.5 text-[0.8125rem] text-ink-soft">
            <PenIcon size={14} /> Can be personalized
          </p>
        ) : null}
      </div>
    </article>
  );
}

export function ProductGrid({ products, base, currency, columns = 4, priorityCount = 0 }: { products: ProductCardData[]; base: string; currency: CurrencyConfig; columns?: 3 | 4; priorityCount?: number }) {
  return (
    <ul className={cn("grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6", columns === 4 ? "md:grid-cols-3 xl:grid-cols-4" : "md:grid-cols-3")}>
      {products.map((product, index) => (
        <li key={product.id}>
          <ProductCard product={product} base={base} currency={currency} priority={index < priorityCount} />
        </li>
      ))}
    </ul>
  );
}
