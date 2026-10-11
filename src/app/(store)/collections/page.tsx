import type { Metadata } from "next";
import Link from "next/link";
import { getPublishedCollections } from "@/lib/catalog/queries";
import { publicMediaBase } from "@/lib/storage";
import { Container, EmptyState, PageHeading } from "@/components/ui/misc";
import { ImagePlaceholder, ResponsiveImage } from "@/components/ui/responsive-image";

export const metadata: Metadata = {
  title: "Collections",
  description: "Seasonal, occasion and limited-edition collections from Souvenir Galore.",
  alternates: { canonical: "/collections" },
};

export default async function CollectionsPage() {
  const collections = await getPublishedCollections();
  const base = publicMediaBase();
  return (
    <Container wide className="space-y-10 py-10 sm:py-14">
      <PageHeading title="Collections" description="Pieces grouped for the moments they're made for — seasons, celebrations and small limited runs." />
      {collections.length ? (
        <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((collection) => (
            <li key={collection.id}>
              <Link href={`/collections/${collection.slug}`} className="group block">
                <div className="aspect-[4/3] overflow-hidden rounded-[var(--radius-image)] bg-plaster">
                  {collection.image ? (
                    <ResponsiveImage media={collection.image} base={base} alt="" sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
                  ) : (
                    <ImagePlaceholder label={collection.name} />
                  )}
                </div>
                <h2 className="mt-4 font-display text-2xl text-ink group-hover:underline group-hover:underline-offset-4">{collection.name}</h2>
                {collection.description ? <p className="mt-1 line-clamp-2 text-ink-soft">{collection.description}</p> : null}
                <p className="mt-1 text-sm text-ink-soft">{collection._count.products === 1 ? "1 piece" : `${collection._count.products} pieces`}</p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No collections yet">New collections are on their way.</EmptyState>
      )}
    </Container>
  );
}
