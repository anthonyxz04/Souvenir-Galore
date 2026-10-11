"use client";

import { useActionState, useState } from "react";
import { submitReviewAction } from "@/server/actions/account";
import { initialFormState } from "@/lib/validation/forms";
import { InputField, TextareaField } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { StarIcon } from "@/components/ui/icons";
import { SubmitButton } from "@/components/ui/submit-button";
import { submitWithoutReset } from "@/lib/submit-without-reset";

export function ReviewForm({ productId }: { productId: string }) {
  const [state, action] = useActionState(submitReviewAction, initialFormState);
  const [rating, setRating] = useState(0);
  if (state.status === "success") return <FormMessage state={state} />;
  return (
    <form action={action} onSubmit={submitWithoutReset(action)} className="space-y-4 rounded-2xl bg-plaster p-5" noValidate>
      <input type="hidden" name="productId" value={productId} />
      <FormMessage state={state} />
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">Your rating</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer rounded-md p-1 text-wax has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-olive">
              <input type="radio" name="rating" value={n} checked={rating === n} onChange={() => setRating(n)} className="sr-only" />
              <StarIcon size={28} filled={n <= rating} strokeWidth={1.2} />
              <span className="sr-only">
                {n} {n === 1 ? "star" : "stars"}
              </span>
            </label>
          ))}
        </div>
        {state.fieldErrors?.rating ? <p className="mt-1 text-[0.8125rem] text-wine">{state.fieldErrors.rating}</p> : null}
      </fieldset>
      <InputField name="title" label="Title" optional maxLength={120} defaultValue={state.values?.title} error={state.fieldErrors?.title} />
      <TextareaField name="body" label="Your review" required maxLength={2000} defaultValue={state.values?.body} error={state.fieldErrors?.body} />
      <p className="text-[0.8125rem] text-ink-soft">Reviews are checked before they appear. We show your first name only.</p>
      <SubmitButton pendingLabel="Sending…">Submit review</SubmitButton>
    </form>
  );
}
