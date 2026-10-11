import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategoryBySlug } from "@/lib/catalog/queries";
import type { SearchParams } from "@/lib/catalog/list-params";
import { absoluteUrl } from "@/lib/env";
import { truncate } from "@/lib/text";
import { JsonLd } from "@/components/json-ld";
import { Breadcrumbs, Container, PageHeading } from "@/components/ui/misc";
import { ProductListing } from "@/components/store/product-listing";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: "Category not found" };
  return {
    title: category.seoTitle || category.name,
    description: category.seoDescription || (category.description ? truncate(category.description, 160) : `Shop handmade ${category.name.toLowerCase()} from Souvenir Galore.`),
    alternates: { canonical: `/category/${category.slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();
  const query = await searchParams;

  const trail = [
    { label: "Home", href: "/" },
    { label: "Shop", href: "/shop" },
    ...(category.parent?.parent ? [{ label: category.parent.parent.name, href: `/category/${category.parent.parent.slug}` }] : []),
    ...(category.parent ? [{ label: category.parent.name, href: `/category/${category.parent.slug}` }] : []),
    { label: category.name },
  ];

  return (
    <Container wide className="space-y-10 py-10 sm:py-14">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: trail.map((item, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: item.label,
            ...(item.href ? { item: absoluteUrl(item.href) } : {}),
          })),
        }}
      />
      <div className="space-y-5">
        <Breadcrumbs items={trail} />
        <PageHeading title={category.name} description={category.description} />
        {category.children.length ? (
          <ul className="flex flex-wrap gap-2" aria-label={`${category.name} categories`}>
            {category.children.map((child) => (
              <li key={child.id}>
                <Link href={`/category/${child.slug}`} className="inline-flex h-10 items-center rounded-full bg-plaster px-4 text-[0.9375rem] ring-1 ring-line hover:ring-ink/40">
                  {child.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <ProductListing pathname={`/category/${category.slug}`} searchParams={query} scope={{ categoryId: category.id }} emptyBody="New pieces for this category are being made. Check back soon or ask us about a custom order." />
    </Container>
  );
}
