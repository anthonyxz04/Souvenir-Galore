"use client";

import { useActionState, useState } from "react";
import { submitCustomRequestAction } from "@/server/actions/public";
import { initialFormState, type FormState } from "@/lib/validation/forms";
import { InputField, SelectField, TextareaField } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SpamFields } from "@/components/ui/spam-fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { CloseIcon, UploadIcon } from "@/components/ui/icons";
import { compressImage } from "@/lib/client-image";

const MAX_FILES = 3;

export function CustomOrderForm({
  defaults,
  uploadsEnabled,
  maxUploadMb,
  product,
}: {
  defaults: { name?: string; email?: string; phone?: string | null };
  uploadsEnabled: boolean;
  maxUploadMb: number;
  product: { id: string; name: string } | null;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [state, formAction] = useActionState(async (prev: FormState, formData: FormData) => {
    formData.delete("references");
    for (const file of files) formData.append("references", file, file.name);
    return submitCustomRequestAction(prev, formData);
  }, initialFormState);
  const v = state.values ?? {};
  const e = state.fieldErrors ?? {};

  async function onFiles(list: FileList | null) {
    setFileError(null);
    if (!list) return;
    const incoming = Array.from(list).slice(0, MAX_FILES - files.length);
    const processed: File[] = [];
    for (const file of incoming) {
      if (!file.type.startsWith("image/")) {
        setFileError("Only photos and images can be attached.");
        continue;
      }
      try {
        const compressed = await compressImage(file, 2000, 0.85);
        if (compressed.size > maxUploadMb * 1024 * 1024) {
          setFileError(`“${file.name}” is too large even after resizing.`);
          continue;
        }
        processed.push(compressed);
      } catch {
        setFileError(`“${file.name}” couldn't be read. Try a JPEG or PNG.`);
      }
    }
    setFiles((current) => [...current, ...processed].slice(0, MAX_FILES));
  }

  if (state.status === "success") {
    return <FormMessage state={state} className="text-base" />;
  }

  return (
    <form action={formAction} className="space-y-10" noValidate>
      <SpamFields />
      {product ? <input type="hidden" name="productId" value={product.id} /> : null}
      <FormMessage state={state} />

      <fieldset className="space-y-5">
        <legend className="mb-4 font-display text-2xl">What would you like made?</legend>
        <InputField
          name="productType"
          label="Piece or product type"
          required
          placeholder="e.g. Concrete candle favors, engraved cross, resin tray"
          defaultValue={v.productType ?? product?.name ?? ""}
          error={e.productType}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <InputField name="occasion" label="Occasion" optional placeholder="Wedding, baptism, corporate event…" defaultValue={v.occasion} error={e.occasion} />
          <InputField name="quantity" label="Quantity" optional type="number" min={1} inputMode="numeric" defaultValue={v.quantity} error={e.quantity} />
          <InputField name="desiredDate" label="Needed by" optional type="date" defaultValue={v.desiredDate} error={e.desiredDate} hint="Handmade pieces need time — the earlier the better." />
          <SelectField
            name="budgetRange"
            label="Budget"
            optional
            placeholder="Prefer not to say"
            defaultValue={v.budgetRange ?? ""}
            options={["Under $50", "$50 – $150", "$150 – $500", "$500 – $1,500", "Over $1,500"].map((o) => ({ value: o, label: o }))}
          />
        </div>
        <TextareaField name="preferences" label="Colors, materials or design" optional rows={3} placeholder="Sage and gold, concrete with a wooden lid, minimal design…" defaultValue={v.preferences} error={e.preferences} />
        <TextareaField name="personalizationText" label="Names, dates or messages" optional rows={3} placeholder="Maya & Karim — 14.06.2026" defaultValue={v.personalizationText} error={e.personalizationText} />
        <TextareaField name="details" label="Tell us more" required rows={5} placeholder="Anything that helps us understand your idea — sizes, packaging, scents, where it will be used." defaultValue={v.details} error={e.details} />
      </fieldset>

      {uploadsEnabled ? (
        <fieldset className="space-y-3">
          <legend className="mb-2 font-display text-2xl">Reference images</legend>
          <p className="text-[0.9375rem] text-ink-soft">Optional. Up to {MAX_FILES} photos or screenshots of ideas you like. They&apos;re only seen by our team.</p>
          {files.length < MAX_FILES ? (
            <label className="flex cursor-pointer items-center justify-center gap-3 rounded-2xl border border-dashed border-line-strong bg-plaster px-6 py-8 text-[0.9375rem] text-ink-soft hover:border-ink/50 hover:text-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-olive">
              <UploadIcon />
              <span>Choose images</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(event) => onFiles(event.target.files)} />
            </label>
          ) : null}
          {fileError || e.references ? <p className="text-sm text-wine">{fileError ?? e.references}</p> : null}
          {files.length ? (
            <ul className="flex flex-wrap gap-3">
              {files.map((file, index) => (
                <li key={`${file.name}-${index}`} className="relative h-24 w-24 overflow-hidden rounded-xl bg-limestone-deep">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={URL.createObjectURL(file)} alt={`Reference ${index + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                    className="absolute right-1 top-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-plaster/95 text-ink"
                    aria-label={`Remove reference ${index + 1}`}
                  >
                    <CloseIcon size={14} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </fieldset>
      ) : null}

      <fieldset className="space-y-5">
        <legend className="mb-4 font-display text-2xl">How can we reach you?</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <InputField name="name" label="Full name" required autoComplete="name" defaultValue={v.name ?? defaults.name} error={e.name} />
          <InputField name="email" label="Email" required type="email" autoComplete="email" defaultValue={v.email ?? defaults.email} error={e.email} />
          <InputField name="phone" label="Phone" optional type="tel" autoComplete="tel" defaultValue={v.phone ?? defaults.phone ?? ""} error={e.phone} />
          <SelectField
            name="contactPreference"
            label="Preferred contact"
            optional
            placeholder="Email is fine"
            defaultValue={v.contactPreference ?? ""}
            options={[
              { value: "EMAIL", label: "Email" },
              { value: "WHATSAPP", label: "WhatsApp" },
              { value: "PHONE", label: "Phone call" },
              { value: "INSTAGRAM", label: "Instagram" },
            ]}
          />
        </div>
      </fieldset>

      <div className="space-y-3">
        <SubmitButton size="lg" pendingLabel="Sending request…">
          Send request
        </SubmitButton>
        <p className="text-[0.8125rem] text-ink-soft">This is a request, not an order. Nothing is charged — we&apos;ll reply with questions or a quote first.</p>
      </div>
    </form>
  );
}
