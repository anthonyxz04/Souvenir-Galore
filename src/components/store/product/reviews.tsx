import Link from "next/link";
import { Stars } from "@/components/ui/misc";
import { ReviewForm } from "./review-form";

type Review = { id: string; authorName: string; rating: number; title: string | null; body: string; verifiedPurchase: boolean; createdAt: Date };

export function ProductReviews({
  productId,
  reviews,
  ratingAvg,
  ratingCount,
  canReview,
  signedIn,
  emailVerified,
  loginHref,
}: {
  productId: string;
  reviews: Review[];
  ratingAvg: number;
  ratingCount: number;
  canReview: boolean;
  signedIn: boolean;
  emailVerified: boolean;
  loginHref: string;
}) {
  return (
    <section id="reviews" aria-labelledby="reviews-heading" className="mt-16 grid gap-10 border-t border-line pt-12 lg:grid-cols-12">
      <div className="space-y-4 lg:col-span-4">
        <h2 id="reviews-heading" className="font-display text-subtitle">
          Reviews
        </h2>
        {ratingCount > 0 ? (
          <div className="flex items-center gap-3">
            <Stars rating={ratingAvg} size={20} />
            <span className="text-ink-soft">
              {ratingAvg.toFixed(1)} from {ratingCount === 1 ? "1 review" : `${ratingCount} reviews`}
            </span>
          </div>
        ) : (
          <p className="text-ink-soft">No reviews yet.</p>
        )}
        {!signedIn ? (
          <p className="text-[0.9375rem] text-ink-soft">
            <Link href={loginHref} className="text-olive underline underline-offset-4">
              Sign in
            </Link>{" "}
            to write a review.
          </p>
        ) : !emailVerified ? (
          <p className="text-[0.9375rem] text-ink-soft">Confirm your email address to write a review.</p>
        ) : canReview ? (
          <ReviewForm productId={productId} />
        ) : (
          <p className="text-[0.9375rem] text-ink-soft">Thank you — you&apos;ve already reviewed this piece.</p>
        )}
      </div>
      <div className="lg:col-span-8">
        {reviews.length ? (
          <ul className="divide-y divide-line">
            {reviews.map((review) => (
              <li key={review.id} className="space-y-2 py-6 first:pt-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Stars rating={review.rating} />
                  {review.title ? <p className="font-medium text-ink">{review.title}</p> : null}
                </div>
                <p className="whitespace-pre-line leading-relaxed text-ink">{review.body}</p>
                <p className="text-sm text-ink-soft">
                  {review.authorName}
                  {review.verifiedPurchase ? ", verified purchase" : ""} — {review.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
