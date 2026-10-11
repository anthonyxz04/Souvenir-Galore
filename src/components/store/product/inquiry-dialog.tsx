"use client";

import { useActionState } from "react";
import { sendProductInquiryAction } from "@/server/actions/public";
import { initialFormState } from "@/lib/validation/forms";
import { buttonClass } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { InputField, TextareaField } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { ChatIcon } from "@/components/ui/icons";
import { SpamFields } from "@/components/ui/spam-fields";
import { SubmitButton } from "@/components/ui/submit-button";

export function InquiryDialog({
  productId,
  productName,
  variantTitle,
  quantity,
  personalization,
}: {
  productId: string;
  productName: string;
  variantTitle: string | null;
  quantity: number;
  personalization: string;
}) {
  const [state, action] = useActionState(sendProductInquiryAction, initialFormState);
  return (
    <Dialog>
      <DialogTrigger className={buttonClass("secondary", "sm")}>
        <ChatIcon size={17} /> Ask a question
      </DialogTrigger>
      <DialogContent title={`Ask about ${productName}`} description="We reply by email, usually within one or two working days.">
        {state.status === "success" ? (
          <FormMessage state={state} />
        ) : (
          <form action={action} className="space-y-4" noValidate>
            <SpamFields />
            <input type="hidden" name="productId" value={productId} />
            <input type="hidden" name="variantTitle" value={variantTitle ?? ""} />
            <input type="hidden" name="quantity" value={String(quantity)} />
            <input type="hidden" name="personalization" value={personalization} />
            <FormMessage state={state} />
            {(variantTitle || quantity > 1 || personalization) && (
              <div className="rounded-xl bg-limestone px-4 py-3 text-sm text-ink-soft">
                <p className="font-medium text-ink">Included with your question</p>
                {variantTitle ? <p>Option: {variantTitle}</p> : null}
                <p>Quantity: {quantity}</p>
                {personalization ? <p className="whitespace-pre-line">{personalization}</p> : null}
              </div>
            )}
            <InputField name="name" label="Your name" autoComplete="name" required defaultValue={state.values?.name} error={state.fieldErrors?.name} />
            <InputField name="email" label="Email" type="email" autoComplete="email" required defaultValue={state.values?.email} error={state.fieldErrors?.email} />
            <InputField name="phone" label="Phone" type="tel" autoComplete="tel" optional defaultValue={state.values?.phone} error={state.fieldErrors?.phone} />
            <TextareaField name="message" label="Your question" required defaultValue={state.values?.message} error={state.fieldErrors?.message} />
            <SubmitButton pendingLabel="Sending…">Send question</SubmitButton>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
