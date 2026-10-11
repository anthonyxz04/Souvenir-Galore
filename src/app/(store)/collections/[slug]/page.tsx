import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCollectionBySlug } from "@/lib/catalog/queries";
import type { SearchParams } from "@/lib/catalog/list-params";
import { publicMediaBase } from "@/lib/storage";
import { truncate } from "@/lib/text";
import { Breadcrumbs, Container, PageHeading } from "@/components/ui/misc";
import { ResponsiveImage } from "@/components/ui/responsive-image";
import { ProductListing } from "@/components/store/product-listing";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);
  if (!collection) return { title: "Collection not found" };
  return {
    title: collection.seoTitle || collection.name,
    description: collection.seoDescription || (collection.description ? truncate(collection.description, 160) : undefined),
    alternates: { canonical: `/collections/${collection.slug}` },
  };
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);
  if (!collection) notFound();
  const query = await searchParams;
  return (
    <>
      {collection.image ? (
        <div className="relative h-[38vh] min-h-64 w-full overflow-hidden bg-plaster sm:h-[46vh]">
          <ResponsiveImage media={collection.image} base={publicMediaBase()} alt="" sizes="100vw" priority preferredWidth={1600} className="h-full w-full object-cover" />
        </div>
      ) : null}
      <Container wide className="space-y-10 py-10 sm:py-14">
        <div className="space-y-5">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Collections", href: "/collections" }, { label: collection.name }]} />
          <PageHeading title={collection.name} description={collection.description} />
          {collection.endsAt ? (
            <p className="text-sm text-wax-ink">Available until {collection.endsAt.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}</p>
          ) : null}
        </div>
        <ProductListing pathname={`/collections/${collection.slug}`} searchParams={query} scope={{ collectionId: collection.id }} />
      </Container>
    </>
  );
}
