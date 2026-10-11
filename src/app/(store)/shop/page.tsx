import type { Metadata } from "next";
import type { SearchParams } from "@/lib/catalog/list-params";
import { Container, PageHeading } from "@/components/ui/misc";
import { ProductListing } from "@/components/store/product-listing";

export const metadata: Metadata = {
  title: "Shop all",
  description: "Handmade candles, personalized gifts, favors, décor and keepsakes — browse the full Souvenir Galore collection.",
  alternates: { canonical: "/shop" },
};

export default async function ShopPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  return (
    <Container wide className="space-y-10 py-10 sm:py-14">
      <PageHeading title="Shop all" description="Everything in the workshop, from candles poured in small batches to keepsakes made with your names and dates." />
      <ProductListing pathname="/shop" searchParams={params} />
    </Container>
  );
}
