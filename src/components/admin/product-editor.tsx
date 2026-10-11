"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { saveProductAction } from "@/server/actions/admin/products";
import { variantCombinations, variantTitle } from "@/lib/catalog/pricing";
import { slugify } from "@/lib/text";
import { initialFormState } from "@/lib/validation/forms";
import { cn } from "@/lib/utils";
import { buttonClass } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { ArrowDownIcon, ArrowUpIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon, StarIcon, TrashIcon } from "@/components/ui/icons";
import { ImageUploader, type UploadedAsset } from "./image-uploader";
import { submitWithoutReset } from "@/lib/submit-without-reset";

type VariantState = {
  id?: string;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  sku: string;
  price: string;
  salePrice: string;
  costPrice: string;
  stock: number;
  stockAdjustment: number;
  isActive: boolean;
};

type FieldState = {
  id?: string;
  key: string;
  label: string;
  type: "TEXT" | "TEXTAREA" | "DATE" | "SELECT";
  isRequired: boolean;
  maxLength: number | null;
  optionsText: string;
  priceDelta: string;
  placeholder: string;
  helpText: string;
};

export type EditorProduct = {
  id?: string;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  pricingType: "FIXED" | "QUOTE";
  isFeatured: boolean;
  isBestseller: boolean;
  isLimitedEdition: boolean;
  trackInventory: boolean;
  allowBackorder: boolean;
  madeToOrder: boolean;
  allowInquiry: boolean;
  lowStockThreshold: number | null;
  prepTimeMinDays: number | null;
  prepTimeMaxDays: number | null;
  maxPerOrder: number | null;
  saleStartsAt: string | null;
  saleEndsAt: string | null;
  seoTitle: string;
  seoDescription: string;
  options: { name: string; values: string[] }[];
  variants: Omit<VariantState, "stockAdjustment">[];
  personalizationFields: {
    id?: string;
    label: string;
    type: FieldState["type"];
    isRequired: boolean;
    maxLength: number | null;
    options: string[];
    priceDelta: string;
    placeholder: string | null;
    helpText: string | null;
  }[];
  images: { assetId: string; alt: string; url: string }[];
  categoryIds: string[];
  collectionIds: string[];
  tagIds: string[];
};

export type EditorChoices = {
  categories: { id: string; name: string; depth: number }[];
  collections: { id: string; name: string }[];
  tagGroups: { id: string; name: string; tags: { id: string; name: string }[] }[];
  currencyCode: string;
  storeUrl: string;
};

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const intOrNull = (value: string) => (value.trim() === "" ? null : Math.max(0, Math.floor(Number(value)) || 0));

function Section({ title, description, children, aside }: { title: string; description?: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-plaster ring-1 ring-line/70">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line/70 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {description ? <p className="text-sm text-ink-soft">{description}</p> : null}
        </div>
        {aside}
      </div>
      <div className="space-y-5 p-5">{children}</div>
    </section>
  );
}

function Label({ htmlFor, children, optional }: { htmlFor: string; children: React.ReactNode; optional?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between text-sm font-medium">
      <span>{children}</span>
      {optional ? <span className="text-xs font-normal text-ink-soft">Optional</span> : null}
    </label>
  );
}

function Err({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-[0.8125rem] text-wine">{message}</p> : null;
}

function Check({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-olive" />
      <span>
        <span className="block text-[0.9375rem]">{label}</span>
        {description ? <span className="block text-[0.8125rem] text-ink-soft">{description}</span> : null}
      </span>
    </label>
  );
}

let keyCounter = 0;
const nextKey = () => `f${(keyCounter += 1)}`;

export function ProductEditor({ initial, choices }: { initial: EditorProduct; choices: EditorChoices }) {
  const [state, formAction] = useActionState(saveProductAction, initialFormState);
  const errors = state.fieldErrors ?? {};

  const [p, setP] = useState(() => ({
    ...initial,
    saleStartsAt: "",
    saleEndsAt: "",
    lowStockThreshold: initial.lowStockThreshold === null ? "" : String(initial.lowStockThreshold),
    prepTimeMinDays: initial.prepTimeMinDays === null ? "" : String(initial.prepTimeMinDays),
    prepTimeMaxDays: initial.prepTimeMaxDays === null ? "" : String(initial.prepTimeMaxDays),
    maxPerOrder: initial.maxPerOrder === null ? "" : String(initial.maxPerOrder),
  }));
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.id));
  const [optionDrafts, setOptionDrafts] = useState(() => initial.options.map((o) => ({ name: o.name, valuesText: o.values.join(", ") })));
  const [variants, setVariants] = useState<VariantState[]>(() => initial.variants.map((v) => ({ ...v, stockAdjustment: 0 })));
  const [fields, setFields] = useState<FieldState[]>(() =>
    initial.personalizationFields.map(({ options: fieldOptions, ...f }) => ({
      ...f,
      key: nextKey(),
      optionsText: fieldOptions.join(", "),
      placeholder: f.placeholder ?? "",
      helpText: f.helpText ?? "",
    })),
  );
  const [images, setImages] = useState(initial.images);

  // Datetime inputs use the browser's time zone, so set them after mounting.
  useEffect(() => {
    setP((prev) => ({ ...prev, saleStartsAt: toLocalInput(initial.saleStartsAt), saleEndsAt: toLocalInput(initial.saleEndsAt) }));
  }, [initial.saleStartsAt, initial.saleEndsAt]);

  const update = <K extends keyof typeof p>(key: K, value: (typeof p)[K]) => setP((prev) => ({ ...prev, [key]: value }));

  const options = useMemo(
    () =>
      optionDrafts
        .map((o) => ({ name: o.name.trim(), values: [...new Set(o.valuesText.split(",").map((v) => v.trim()).filter(Boolean))] }))
        .filter((o) => o.name && o.values.length),
    [optionDrafts],
  );
  const optionsKey = JSON.stringify(options);

  // Keep the variant list in step with the options, preserving existing rows.
  useEffect(() => {
    setVariants((current) => {
      if (options.length === 0) {
        const base = current.find((v) => !v.option1) ?? current[0];
        return [{ ...(base ?? emptyVariant()), option1: null, option2: null, option3: null }];
      }
      const combos = variantCombinations(options);
      const template = current[0] ?? emptyVariant();
      return combos.map((combo) => {
        const match = current.find((v) => [v.option1, v.option2, v.option3].slice(0, combo.length).every((value, i) => value === combo[i]));
        return match
          ? { ...match, option1: combo[0] ?? null, option2: combo[1] ?? null, option3: combo[2] ?? null }
          : { ...emptyVariant(), price: template.price, salePrice: template.salePrice, costPrice: template.costPrice, option1: combo[0] ?? null, option2: combo[1] ?? null, option3: combo[2] ?? null };
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionsKey]);

  const setVariant = (index: number, patch: Partial<VariantState>) => setVariants((vs) => vs.map((v, i) => (i === index ? { ...v, ...patch } : v)));

  const payload = {
    id: p.id,
    name: p.name,
    slug: p.slug || null,
    shortDescription: p.shortDescription,
    description: p.description,
    status: p.status,
    pricingType: p.pricingType,
    isFeatured: p.isFeatured,
    isBestseller: p.isBestseller,
    isLimitedEdition: p.isLimitedEdition,
    trackInventory: p.trackInventory,
    allowBackorder: p.allowBackorder,
    madeToOrder: p.madeToOrder,
    allowInquiry: p.allowInquiry,
    lowStockThreshold: intOrNull(p.lowStockThreshold),
    prepTimeMinDays: intOrNull(p.prepTimeMinDays),
    prepTimeMaxDays: intOrNull(p.prepTimeMaxDays),
    maxPerOrder: p.maxPerOrder.trim() ? Math.max(1, intOrNull(p.maxPerOrder) ?? 1) : null,
    saleStartsAt: p.saleStartsAt ? new Date(p.saleStartsAt).toISOString() : null,
    saleEndsAt: p.saleEndsAt ? new Date(p.saleEndsAt).toISOString() : null,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    options,
    variants: variants.map((v) => ({
      id: v.id,
      option1: v.option1,
      option2: v.option2,
      option3: v.option3,
      sku: v.sku || null,
      price: v.price || "0",
      salePrice: v.salePrice || null,
      costPrice: v.costPrice || null,
      stock: v.id ? 0 : v.stock,
      stockAdjustment: v.id ? v.stockAdjustment : 0,
      isActive: v.isActive,
    })),
    personalizationFields: fields.map((f) => ({
      id: f.id,
      label: f.label,
      type: f.type,
      isRequired: f.isRequired,
      maxLength: f.maxLength,
      options: f.optionsText.split(",").map((o) => o.trim()).filter(Boolean),
      priceDelta: f.priceDelta || null,
      placeholder: f.placeholder || null,
      helpText: f.helpText || null,
    })),
    images: images.map((i) => ({ assetId: i.assetId, alt: i.alt || null })),
    categoryIds: p.categoryIds,
    collectionIds: p.collectionIds,
    tagIds: p.tagIds,
  };

  const toggleId = (key: "categoryIds" | "collectionIds" | "tagIds", id: string) =>
    setP((prev) => ({ ...prev, [key]: prev[key].includes(id) ? prev[key].filter((x) => x !== id) : [...prev[key], id] }));

  const moveImage = (index: number, delta: number) =>
    setImages((list) => {
      const next = [...list];
      const target = index + delta;
      if (target < 0 || target >= next.length) return list;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const single = options.length === 0;
  const isQuote = p.pricingType === "QUOTE";

  return (
    <form action={formAction} onSubmit={submitWithoutReset(formAction)} className="space-y-6 pb-28" noValidate>
      <input type="hidden" name="payload" value={JSON.stringify(payload)} />
      <FormMessage state={state} />
      {Object.keys(errors).length > 1 ? (
        <ul className="list-disc space-y-0.5 rounded-xl bg-wine-soft px-8 py-3 text-sm text-wine">
          {Object.entries(errors)
            .slice(0, 8)
            .map(([key, message]) => (
              <li key={key}>{message}</li>
            ))}
        </ul>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Section title="Basics">
            <div>
              <Label htmlFor="pe-name">Product name</Label>
              <input
                id="pe-name"
                className={controlClass}
                value={p.name}
                maxLength={200}
                onChange={(e) => {
                  update("name", e.target.value);
                  if (!slugTouched) update("slug", slugify(e.target.value));
                }}
                aria-invalid={errors.name ? true : undefined}
              />
              <Err message={errors.name} />
            </div>
            <div>
              <Label htmlFor="pe-slug">Web address</Label>
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-sm text-ink-soft">/products/</span>
                <input
                  id="pe-slug"
                  className={controlClass}
                  value={p.slug}
                  maxLength={100}
                  onChange={(e) => {
                    setSlugTouched(true);
                    update("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
                  }}
                />
              </div>
              <Err message={errors.slug} />
            </div>
            <div>
              <Label htmlFor="pe-short" optional>
                Short description
              </Label>
              <textarea id="pe-short" rows={2} maxLength={300} className={controlClass} value={p.shortDescription} onChange={(e) => update("shortDescription", e.target.value)} />
              <p className="mt-1 text-[0.8125rem] text-ink-soft">Shown under the name on the product page and in search results.</p>
            </div>
            <div>
              <Label htmlFor="pe-desc" optional>
                Full description
              </Label>
              <textarea id="pe-desc" rows={8} maxLength={20000} className={cn(controlClass, "font-mono text-sm")} value={p.description} onChange={(e) => update("description", e.target.value)} />
              <p className="mt-1 text-[0.8125rem] text-ink-soft">
                Formatting: <code>**bold**</code>, <code>- list item</code>, <code>## Heading</code>. Mention materials, size, scent, burn time and care.
              </p>
            </div>
          </Section>

          <Section title="Photos" description="The first photo is the main image. Use natural light and a plain background.">
            {images.length ? (
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {images.map((image, index) => (
                  <li key={image.assetId} className="space-y-2">
                    <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-limestone-deep">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image.url} alt="" className="h-full w-full object-cover" />
                      {index === 0 ? <span className="absolute left-2 top-2 rounded-full bg-olive px-2 py-0.5 text-xs text-white">Main</span> : null}
                    </div>
                    <input
                      aria-label={`Description of photo ${index + 1}`}
                      placeholder="Describe the photo"
                      className={cn(controlClass, "py-1.5 text-sm")}
                      value={image.alt}
                      maxLength={200}
                      onChange={(e) => setImages((list) => list.map((img, i) => (i === index ? { ...img, alt: e.target.value } : img)))}
                    />
                    <div className="flex items-center justify-between">
                      <div className="flex">
                        <button type="button" onClick={() => moveImage(index, -1)} disabled={index === 0} className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-ink/5 disabled:opacity-30" aria-label="Move earlier">
                          <ChevronLeftIcon size={16} />
                        </button>
                        <button type="button" onClick={() => moveImage(index, 1)} disabled={index === images.length - 1} className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-ink/5 disabled:opacity-30" aria-label="Move later">
                          <ChevronRightIcon size={16} />
                        </button>
                        {index > 0 ? (
                          <button type="button" onClick={() => setImages((list) => [list[index], ...list.filter((_, i) => i !== index)])} className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-ink/5" aria-label="Make main photo">
                            <StarIcon size={16} />
                          </button>
                        ) : null}
                      </div>
                      <button type="button" onClick={() => setImages((list) => list.filter((_, i) => i !== index))} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-wine hover:bg-wine-soft" aria-label="Remove photo">
                        <TrashIcon size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
            <ImageUploader purpose="products" onUploaded={(asset: UploadedAsset) => setImages((list) => [...list, { assetId: asset.id, alt: "", url: asset.url }].slice(0, 20))} />
          </Section>

          <Section title="Options" description="Up to three, such as Size, Scent or Color. Each combination becomes a variant with its own price and stock.">
            {optionDrafts.map((option, index) => (
              <div key={index} className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)_auto] sm:items-end">
                <div>
                  <Label htmlFor={`opt-name-${index}`}>Option name</Label>
                  <input id={`opt-name-${index}`} className={controlClass} value={option.name} maxLength={40} placeholder="Scent" onChange={(e) => setOptionDrafts((list) => list.map((o, i) => (i === index ? { ...o, name: e.target.value } : o)))} />
                </div>
                <div>
                  <Label htmlFor={`opt-values-${index}`}>Values, separated by commas</Label>
                  <input id={`opt-values-${index}`} className={controlClass} value={option.valuesText} placeholder="Vanilla, Oud, Jasmine" onChange={(e) => setOptionDrafts((list) => list.map((o, i) => (i === index ? { ...o, valuesText: e.target.value } : o)))} />
                </div>
                <button type="button" onClick={() => setOptionDrafts((list) => list.filter((_, i) => i !== index))} className={buttonClass("ghost", "md", "text-wine")}>
                  Remove
                </button>
              </div>
            ))}
            <Err message={errors.options} />
            {optionDrafts.length < 3 ? (
              <button type="button" onClick={() => setOptionDrafts((list) => [...list, { name: "", valuesText: "" }])} className={buttonClass("secondary", "sm")}>
                <PlusIcon size={16} /> Add an option
              </button>
            ) : null}
          </Section>

          <Section title={single ? "Price & stock" : `Variants (${variants.length})`} description={isQuote ? "This product is quote-only, so prices are optional." : `Prices in ${choices.currencyCode}.`}>
            <Err message={errors.variants} />
            {!single ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={buttonClass("secondary", "sm")}
                  onClick={() => setVariants((vs) => vs.map((v) => ({ ...v, price: vs[0]?.price ?? v.price, salePrice: vs[0]?.salePrice ?? v.salePrice })))}
                >
                  Copy first row&apos;s prices to all
                </button>
              </div>
            ) : null}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-ink-soft">
                    {!single ? <th className="pb-2 pr-2 font-semibold">Variant</th> : null}
                    <th className="pb-2 pr-2 font-semibold">Price</th>
                    <th className="pb-2 pr-2 font-semibold">Sale price</th>
                    <th className="pb-2 pr-2 font-semibold">Cost</th>
                    <th className="pb-2 pr-2 font-semibold">SKU</th>
                    <th className="pb-2 pr-2 font-semibold">{p.trackInventory ? "Stock" : "Stock (not tracked)"}</th>
                    {!single ? <th className="pb-2 font-semibold">For sale</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {variants.map((variant, index) => (
                    <tr key={`${variant.id ?? "new"}-${variant.option1}-${variant.option2}-${variant.option3}`} className="align-top">
                      {!single ? <td className="py-1.5 pr-2 pt-3.5 font-medium">{variantTitle([variant.option1, variant.option2, variant.option3])}</td> : null}
                      <td className="py-1.5 pr-2">
                        <input aria-label="Price" inputMode="decimal" className={cn(controlClass, "w-28 py-2")} value={variant.price} onChange={(e) => setVariant(index, { price: e.target.value })} aria-invalid={errors[`variants.${index}.price`] ? true : undefined} />
                        <Err message={errors[`variants.${index}.price`]} />
                      </td>
                      <td className="py-1.5 pr-2">
                        <input aria-label="Sale price" inputMode="decimal" className={cn(controlClass, "w-28 py-2")} value={variant.salePrice} onChange={(e) => setVariant(index, { salePrice: e.target.value })} />
                        <Err message={errors[`variants.${index}.salePrice`]} />
                      </td>
                      <td className="py-1.5 pr-2">
                        <input aria-label="Cost" inputMode="decimal" className={cn(controlClass, "w-24 py-2")} value={variant.costPrice} onChange={(e) => setVariant(index, { costPrice: e.target.value })} />
                      </td>
                      <td className="py-1.5 pr-2">
                        <input aria-label="SKU" className={cn(controlClass, "w-32 py-2")} value={variant.sku} maxLength={64} onChange={(e) => setVariant(index, { sku: e.target.value })} />
                      </td>
                      <td className="py-1.5 pr-2">
                        {variant.id ? (
                          <div className="flex items-center gap-2">
                            <span className="w-10 text-right tabular-nums">{variant.stock + variant.stockAdjustment}</span>
                            <input
                              aria-label="Adjust stock by"
                              type="number"
                              className={cn(controlClass, "w-24 py-2")}
                              value={variant.stockAdjustment || ""}
                              placeholder="± adjust"
                              onChange={(e) => setVariant(index, { stockAdjustment: Math.trunc(Number(e.target.value)) || 0 })}
                            />
                          </div>
                        ) : (
                          <input aria-label="Starting stock" type="number" min={0} className={cn(controlClass, "w-24 py-2")} value={variant.stock} onChange={(e) => setVariant(index, { stock: Math.max(0, Math.trunc(Number(e.target.value)) || 0) })} />
                        )}
                      </td>
                      {!single ? (
                        <td className="py-1.5 pt-3">
                          <input type="checkbox" aria-label="For sale" checked={variant.isActive} onChange={(e) => setVariant(index, { isActive: e.target.checked })} className="h-5 w-5 accent-olive" />
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[0.8125rem] text-ink-soft">To change stock for an existing variant, enter how many to add (e.g. 5) or remove (e.g. -2). Changes are logged.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="pe-sale-start" optional>
                  Sale starts
                </Label>
                <input id="pe-sale-start" type="datetime-local" className={controlClass} value={p.saleStartsAt} onChange={(e) => update("saleStartsAt", e.target.value)} />
                <Err message={errors.saleStartsAt} />
              </div>
              <div>
                <Label htmlFor="pe-sale-end" optional>
                  Sale ends
                </Label>
                <input id="pe-sale-end" type="datetime-local" className={controlClass} value={p.saleEndsAt} onChange={(e) => update("saleEndsAt", e.target.value)} />
                <Err message={errors.saleEndsAt} />
              </div>
            </div>
            <p className="text-[0.8125rem] text-ink-soft">Sale prices apply between these dates. Leave both empty to apply sale prices immediately and indefinitely.</p>
          </Section>

          <Section
            title="Personalization"
            description="Fields customers fill in, like a name, date or message. Leave empty if the product isn't personalized."
            aside={
              fields.length < 10 ? (
                <button
                  type="button"
                  className={buttonClass("secondary", "sm")}
                  onClick={() => setFields((list) => [...list, { key: nextKey(), label: "", type: "TEXT", isRequired: true, maxLength: null, optionsText: "", priceDelta: "", placeholder: "", helpText: "" }])}
                >
                  <PlusIcon size={16} /> Add field
                </button>
              ) : null
            }
          >
            {fields.length === 0 ? <p className="text-sm text-ink-soft">No personalization fields.</p> : null}
            {fields.map((field, index) => (
              <div key={field.key} className="space-y-3 rounded-xl bg-white/70 p-4 ring-1 ring-line/60">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_8rem]">
                  <div>
                    <Label htmlFor={`pf-label-${field.key}`}>Label</Label>
                    <input id={`pf-label-${field.key}`} className={controlClass} value={field.label} maxLength={60} placeholder="Name on the jar" onChange={(e) => setFields((l) => l.map((f, i) => (i === index ? { ...f, label: e.target.value } : f)))} />
                    <Err message={errors[`personalizationFields.${index}.label`]} />
                  </div>
                  <div>
                    <Label htmlFor={`pf-type-${field.key}`}>Type</Label>
                    <select id={`pf-type-${field.key}`} className={controlClass} value={field.type} onChange={(e) => setFields((l) => l.map((f, i) => (i === index ? { ...f, type: e.target.value as FieldState["type"] } : f)))}>
                      <option value="TEXT">Short text</option>
                      <option value="TEXTAREA">Message</option>
                      <option value="DATE">Date</option>
                      <option value="SELECT">Choice list</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor={`pf-price-${field.key}`} optional>
                      Extra price
                    </Label>
                    <input id={`pf-price-${field.key}`} inputMode="decimal" className={controlClass} value={field.priceDelta} placeholder="0.00" onChange={(e) => setFields((l) => l.map((f, i) => (i === index ? { ...f, priceDelta: e.target.value } : f)))} />
                    <Err message={errors[`personalizationFields.${index}.priceDelta`]} />
                  </div>
                </div>
                {field.type === "SELECT" ? (
                  <div>
                    <Label htmlFor={`pf-options-${field.key}`}>Choices, separated by commas</Label>
                    <input id={`pf-options-${field.key}`} className={controlClass} value={field.optionsText} placeholder="Script, Classic, Arabic calligraphy" onChange={(e) => setFields((l) => l.map((f, i) => (i === index ? { ...f, optionsText: e.target.value } : f)))} />
                    <Err message={errors[`personalizationFields.${index}.options`]} />
                  </div>
                ) : null}
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_8rem]">
                  <div>
                    <Label htmlFor={`pf-ph-${field.key}`} optional>
                      Example text
                    </Label>
                    <input id={`pf-ph-${field.key}`} className={controlClass} value={field.placeholder} maxLength={100} onChange={(e) => setFields((l) => l.map((f, i) => (i === index ? { ...f, placeholder: e.target.value } : f)))} />
                  </div>
                  <div>
                    <Label htmlFor={`pf-help-${field.key}`} optional>
                      Help text
                    </Label>
                    <input id={`pf-help-${field.key}`} className={controlClass} value={field.helpText} maxLength={200} onChange={(e) => setFields((l) => l.map((f, i) => (i === index ? { ...f, helpText: e.target.value } : f)))} />
                  </div>
                  {field.type === "TEXT" || field.type === "TEXTAREA" ? (
                    <div>
                      <Label htmlFor={`pf-max-${field.key}`} optional>
                        Max letters
                      </Label>
                      <input id={`pf-max-${field.key}`} type="number" min={1} max={500} className={controlClass} value={field.maxLength ?? ""} onChange={(e) => setFields((l) => l.map((f, i) => (i === index ? { ...f, maxLength: e.target.value ? Math.min(500, Math.max(1, Number(e.target.value))) : null } : f)))} />
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Check checked={field.isRequired} onChange={(v) => setFields((l) => l.map((f, i) => (i === index ? { ...f, isRequired: v } : f)))} label="Required" />
                  <div className="flex gap-1">
                    <button type="button" disabled={index === 0} onClick={() => setFields((l) => { const n = [...l]; [n[index - 1], n[index]] = [n[index], n[index - 1]]; return n; })} className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-ink/5 disabled:opacity-30" aria-label="Move up">
                      <ArrowUpIcon size={16} />
                    </button>
                    <button type="button" disabled={index === fields.length - 1} onClick={() => setFields((l) => { const n = [...l]; [n[index + 1], n[index]] = [n[index], n[index + 1]]; return n; })} className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-ink/5 disabled:opacity-30" aria-label="Move down">
                      <ArrowDownIcon size={16} />
                    </button>
                    <button type="button" onClick={() => setFields((l) => l.filter((_, i) => i !== index))} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-wine hover:bg-wine-soft" aria-label="Remove field">
                      <TrashIcon size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </Section>

          <Section title="Search engines" description="Optional. Defaults to the product name and short description.">
            <div>
              <Label htmlFor="pe-seo-title" optional>
                Page title
              </Label>
              <input id="pe-seo-title" className={controlClass} value={p.seoTitle} maxLength={70} onChange={(e) => update("seoTitle", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="pe-seo-desc" optional>
                Meta description
              </Label>
              <textarea id="pe-seo-desc" rows={2} className={controlClass} value={p.seoDescription} maxLength={170} onChange={(e) => update("seoDescription", e.target.value)} />
            </div>
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Visibility">
            <div>
              <Label htmlFor="pe-status">Status</Label>
              <select id="pe-status" className={controlClass} value={p.status} onChange={(e) => update("status", e.target.value as typeof p.status)}>
                <option value="DRAFT">Draft (hidden from the store)</option>
                <option value="ACTIVE">Active (visible and for sale)</option>
                <option value="ARCHIVED">Archived (hidden, kept for records)</option>
              </select>
            </div>
            <div>
              <Label htmlFor="pe-pricing">Selling</Label>
              <select id="pe-pricing" className={controlClass} value={p.pricingType} onChange={(e) => update("pricingType", e.target.value as typeof p.pricingType)}>
                <option value="FIXED">Fixed price, add to cart</option>
                <option value="QUOTE">Price on request (quote)</option>
              </select>
            </div>
            <Check checked={p.isFeatured} onChange={(v) => update("isFeatured", v)} label="Featured" description="Shown first in “Featured” sorting and homepage rows." />
            <Check checked={p.isBestseller} onChange={(v) => update("isBestseller", v)} label="Bestseller badge" />
            <Check checked={p.isLimitedEdition} onChange={(v) => update("isLimitedEdition", v)} label="Limited edition badge" />
            <Check checked={p.allowInquiry} onChange={(v) => update("allowInquiry", v)} label="Show “ask a question” options" />
          </Section>

          <Section title="Stock & making">
            <Check checked={p.trackInventory} onChange={(v) => update("trackInventory", v)} label="Track stock" description="Stops sales when stock runs out." />
            <Check checked={p.allowBackorder} onChange={(v) => update("allowBackorder", v)} label="Keep selling when out of stock" description="Orders are marked as backorders." />
            <Check checked={p.madeToOrder} onChange={(v) => update("madeToOrder", v)} label="Made to order" description="Each piece is made after the order is placed." />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="pe-prep-min" optional>
                  Making time from (days)
                </Label>
                <input id="pe-prep-min" type="number" min={0} max={365} className={controlClass} value={p.prepTimeMinDays} onChange={(e) => update("prepTimeMinDays", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="pe-prep-max" optional>
                  to (days)
                </Label>
                <input id="pe-prep-max" type="number" min={0} max={365} className={controlClass} value={p.prepTimeMaxDays} onChange={(e) => update("prepTimeMaxDays", e.target.value)} />
                <Err message={errors.prepTimeMaxDays} />
              </div>
              <div>
                <Label htmlFor="pe-low" optional>
                  Low-stock alert at
                </Label>
                <input id="pe-low" type="number" min={0} className={controlClass} value={p.lowStockThreshold} placeholder="Store default" onChange={(e) => update("lowStockThreshold", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="pe-max" optional>
                  Max per order
                </Label>
                <input id="pe-max" type="number" min={1} className={controlClass} value={p.maxPerOrder} onChange={(e) => update("maxPerOrder", e.target.value)} />
              </div>
            </div>
          </Section>

          <Section title="Categories">
            {choices.categories.length ? (
              <ul className="max-h-72 space-y-1.5 overflow-y-auto">
                {choices.categories.map((category) => (
                  <li key={category.id} style={{ paddingLeft: `${category.depth * 1.25}rem` }}>
                    <Check checked={p.categoryIds.includes(category.id)} onChange={() => toggleId("categoryIds", category.id)} label={category.name} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-soft">
                No categories yet. <Link href="/admin/categories" className="underline">Create one</Link>.
              </p>
            )}
          </Section>

          {choices.collections.length ? (
            <Section title="Collections">
              <ul className="max-h-60 space-y-1.5 overflow-y-auto">
                {choices.collections.map((collection) => (
                  <li key={collection.id}>
                    <Check checked={p.collectionIds.includes(collection.id)} onChange={() => toggleId("collectionIds", collection.id)} label={collection.name} />
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {choices.tagGroups.length ? (
            <Section title="Filters" description="Helps customers find this by occasion, recipient, color…">
              {choices.tagGroups.map((group) => (
                <fieldset key={group.id} className="space-y-1.5">
                  <legend className="mb-1 text-sm font-semibold">{group.name}</legend>
                  <div className="flex flex-wrap gap-1.5">
                    {group.tags.map((tag) => {
                      const on = p.tagIds.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggleId("tagIds", tag.id)}
                          className={cn("rounded-full px-3 py-1 text-sm ring-1", on ? "bg-ink text-white ring-ink" : "bg-white ring-line-strong/70 hover:ring-ink/50")}
                        >
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </Section>
          ) : null}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-limestone/95 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <p className="text-sm text-ink-soft">{p.status === "ACTIVE" ? "Visible in the store after saving." : p.status === "DRAFT" ? "Draft: not visible to customers." : "Archived: not visible to customers."}</p>
          <div className="flex items-center gap-2">
            {p.id ? (
              <Link href={`/products/${p.slug}${p.status !== "ACTIVE" ? "?preview=1" : ""}`} target="_blank" className={buttonClass("ghost", "md")}>
                {p.status === "ACTIVE" ? "View in store" : "Preview"}
              </Link>
            ) : null}
            <SubmitButton pendingLabel="Saving…">{p.id ? "Save product" : "Create product"}</SubmitButton>
          </div>
        </div>
      </div>
    </form>
  );
}

function emptyVariant(): VariantState {
  return { option1: null, option2: null, option3: null, sku: "", price: "", salePrice: "", costPrice: "", stock: 0, stockAdjustment: 0, isActive: true };
}
