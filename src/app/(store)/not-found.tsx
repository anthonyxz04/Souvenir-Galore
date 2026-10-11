import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/misc";

export default function StoreNotFound() {
  return (
    <Container className="py-20 sm:py-28">
      <div className="mx-auto max-w-xl space-y-5 text-center">
        <p className="font-display text-6xl text-wax">404</p>
        <h1 className="font-display text-title">We couldn&apos;t find that page</h1>
        <p className="text-ink-soft">It may have moved, or the piece may no longer be available.</p>
        <div className="flex justify-center gap-3">
          <ButtonLink href="/shop">Browse the shop</ButtonLink>
          <ButtonLink href="/" variant="secondary">
            Go to the homepage
          </ButtonLink>
        </div>
      </div>
    </Container>
  );
}
