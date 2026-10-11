"use client";

import { useActionState, useState } from "react";
import { saveHomeSectionAction } from "@/server/actions/admin/content";
import { initialFormState } from "@/lib/validation/forms";
import { cn } from "@/lib/utils";
import { buttonClass } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { ImageUploader } from "./image-uploader";
import { LocalDateTimeInput } from "./local-datetime-input";
import { submitWithoutReset } from "@/lib/submit-without-reset";

type Item = { key: string; title: string; body: string; href: string; imageId: string | null; imageUrl: string | null };

export type HomeSectionInitial = {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  imageId: string | null;
  imageUrl: string | null;
  isVisible: boolean;
  startsAt: string | null;
  endsAt: string | null;
  config: Record<string, unknown>;
  items: Omit<Item, "key">[];
};

type Choices = {
  products: { id: string; name: string }[];
  categories: { id: string; name: string; depth: number }[];
  collections: { id: string; name: string }[];
};

const FIELDS: Record<string, { subtitle?: boolean; body?: boolean; cta?: boolean; secondaryCta?: boolean; image?: boolean; items?: { label: string; withImage?: boolean; withHref?: boolean; withBody?: boolean } }> = {
  HERO: { subtitle: true, cta: true, secondaryCta: true, image: true },
  CATEGORY_GRID: { subtitle: true, cta: true },
  FEATURED_COLLECTIONS: { subtitle: true },
  PRODUCT_GRID: { subtitle: true, cta: true },
  PROMO_BANNER: { subtitle: true, cta: true, image: true },
  CRAFTSMANSHIP: { subtitle: true, body: true, cta: true, image: true, items: { label: "Points", withBody: true } },
  PERSONALIZATION_STEPS: { subtitle: true, cta: true, items: { label: "Steps", withBody: true } },
  TESTIMONIALS: { subtitle: true },
  INSTAGRAM: { subtitle: true, items: { label: "Photos", withImage: true, withHref: true } },
  NEWSLETTER: { subtitle: true },
};

let counter = 0;
const key = () => `i${(counter += 1)}`;

function TextInput({ id, label, value, onChange, max, optional, hint, error }: { id: string; label: string; value: string; onChange: (v: string) => void; max: number; optional?: boolean; hint?: string; error?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="flex justify-between text-sm font-medium">
        <span>{label}</span>
        {optional ? <span className="text-xs font-normal text-ink-soft">Optional</span> : null}
      </label>
      <input id={id} className={controlClass} value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} aria-invalid={error ? true : undefined} />
      {hint ? <p className="text-[0.8125rem] text-ink-soft">{hint}</p> : null}
      {error ? <p className="text-[0.8125rem] text-wine">{error}</p> : null}
    </div>
  );
}

export function HomeSectionForm({ initial, choices }: { initial: HomeSectionInitial; choices: Choices }) {
  const [state, action] = useActionState(saveHomeSectionAction, initialFormState);
  const e = state.fieldErrors ?? {};
  const f = FIELDS[initial.type] ?? {};
  const [s, setS] = useState(initial);
  const [items, setItems] = useState<Item[]>(() => initial.items.map((i) => ({ ...i, key: key() })));
  const [config, setConfig] = useState<Record<string, unknown>>(initial.config);
  const set = <K extends keyof HomeSectionInitial>(k: K, v: HomeSectionInitial[K]) => setS((prev) => ({ ...prev, [k]: v }));
  const ids = (k: string) => (Array.isArray(config[k]) ? (config[k] as string[]) : []);
  const toggleConfigId = (k: string, id: string) => setConfig((c) => ({ ...c, [k]: ids(k).includes(id) ? ids(k).filter((x) => x !== id) : [...ids(k), id] }));

  const submit = (formData: FormData) => {
    formData.set(
      "payload",
      JSON.stringify({
        id: s.id,
        title: s.title,
        subtitle: s.subtitle,
        body: s.body,
        ctaLabel: s.ctaLabel,
        ctaHref: s.ctaHref,
        secondaryCtaLabel: s.secondaryCtaLabel,
        secondaryCtaHref: s.secondaryCtaHref,
        imageId: s.imageId,
        isVisible: s.isVisible,
        startsAt: (formData.get("startsAt") as string) || null,
        endsAt: (formData.get("endsAt") as string) || null,
        config,
        items: items.map(({ title, body, href, imageId }) => ({ title, body, href, imageId })),
      }),
    );
    return action(formData);
  };

  return (
    <form
      action={submit}
      onSubmit={submitWithoutReset(submit)}
      className="space-y-6"
    >
      <FormMessage state={state} />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-5">
          <TextInput id="hs-title" label="Heading" value={s.title} onChange={(v) => set("title", v)} max={160} optional={initial.type !== "HERO"} />
          {f.subtitle ? (
            <div className="space-y-1.5">
              <label htmlFor="hs-subtitle" className="flex justify-between text-sm font-medium">
                <span>{initial.type === "HERO" ? "Introduction" : "Subheading"}</span>
                <span className="text-xs font-normal text-ink-soft">Optional</span>
              </label>
              <textarea id="hs-subtitle" className={controlClass} rows={3} maxLength={400} value={s.subtitle} onChange={(ev) => set("subtitle", ev.target.value)} />
            </div>
          ) : null}
          {f.body ? (
            <div className="space-y-1.5">
              <label htmlFor="hs-body" className="text-sm font-medium">
                Text
              </label>
              <textarea id="hs-body" className={controlClass} rows={5} maxLength={3000} value={s.body} onChange={(ev) => set("body", ev.target.value)} />
            </div>
          ) : null}
          {f.cta ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput id="hs-cta-label" label="Button label" value={s.ctaLabel} onChange={(v) => set("ctaLabel", v)} max={60} optional />
              <TextInput id="hs-cta-href" label="Button link" value={s.ctaHref} onChange={(v) => set("ctaHref", v)} max={300} optional hint="e.g. /shop or /collections/christmas" error={e.ctaHref} />
            </div>
          ) : null}
          {f.secondaryCta ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput id="hs-cta2-label" label="Second button label" value={s.secondaryCtaLabel} onChange={(v) => set("secondaryCtaLabel", v)} max={60} optional />
              <TextInput id="hs-cta2-href" label="Second button link" value={s.secondaryCtaHref} onChange={(v) => set("secondaryCtaHref", v)} max={300} optional error={e.secondaryCtaHref} />
            </div>
          ) : null}

          {initial.type === "PRODUCT_GRID" ? (
            <fieldset className="space-y-3 rounded-xl bg-white/60 p-4 ring-1 ring-line/60">
              <legend className="px-1 text-sm font-semibold">Which products</legend>
              <select aria-label="Product source" className={controlClass} value={String(config.source ?? "featured")} onChange={(ev) => setConfig((c) => ({ ...c, source: ev.target.value }))}>
                <option value="featured">Featured products</option>
                <option value="bestsellers">Bestsellers</option>
                <option value="new">New arrivals</option>
                <option value="sale">On sale</option>
                <option value="personalizable">Personalizable</option>
                <option value="collection">From a collection</option>
                <option value="category">From a category</option>
                <option value="manual">Hand-picked</option>
              </select>
              {config.source === "collection" ? (
                <select aria-label="Collection" className={controlClass} value={String(config.collectionId ?? "")} onChange={(ev) => setConfig((c) => ({ ...c, collectionId: ev.target.value || null }))}>
                  <option value="">Choose a collection</option>
                  {choices.collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              ) : null}
              {config.source === "category" ? (
                <select aria-label="Category" className={controlClass} value={String(config.categoryId ?? "")} onChange={(ev) => setConfig((c) => ({ ...c, categoryId: ev.target.value || null }))}>
                  <option value="">Choose a category</option>
                  {choices.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {"— ".repeat(c.depth)}
                      {c.name}
                    </option>
                  ))}
                </select>
              ) : null}
              {config.source === "manual" ? (
                <div className="max-h-64 space-y-1 overflow-y-auto">
                  {choices.products.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={ids("productIds").includes(p.id)} onChange={() => toggleConfigId("productIds", p.id)} className="h-4 w-4 accent-olive" />
                      {p.name}
                    </label>
                  ))}
                </div>
              ) : null}
              <label className="flex items-center gap-2 text-sm">
                Show up to
                <input type="number" min={2} max={12} className={cn(controlClass, "w-20 py-1.5")} value={Number(config.limit ?? 8)} onChange={(ev) => setConfig((c) => ({ ...c, limit: Math.min(12, Math.max(2, Number(ev.target.value) || 8)) }))} />
                products
              </label>
            </fieldset>
          ) : null}

          {initial.type === "CATEGORY_GRID" ? (
            <fieldset className="space-y-2 rounded-xl bg-white/60 p-4 ring-1 ring-line/60">
              <legend className="px-1 text-sm font-semibold">Categories to show</legend>
              <p className="text-[0.8125rem] text-ink-soft">Leave all unticked to show your top-level categories.</p>
              {choices.categories.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm" style={{ paddingLeft: `${c.depth}rem` }}>
                  <input type="checkbox" checked={ids("categoryIds").includes(c.id)} onChange={() => toggleConfigId("categoryIds", c.id)} className="h-4 w-4 accent-olive" />
                  {c.name}
                </label>
              ))}
            </fieldset>
          ) : null}

          {initial.type === "FEATURED_COLLECTIONS" ? (
            <fieldset className="space-y-2 rounded-xl bg-white/60 p-4 ring-1 ring-line/60">
              <legend className="px-1 text-sm font-semibold">Collections to show</legend>
              <p className="text-[0.8125rem] text-ink-soft">Leave all unticked to show collections marked “Feature on the homepage”.</p>
              {choices.collections.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={ids("collectionIds").includes(c.id)} onChange={() => toggleConfigId("collectionIds", c.id)} className="h-4 w-4 accent-olive" />
                  {c.name}
                </label>
              ))}
            </fieldset>
          ) : null}

          {initial.type === "TESTIMONIALS" ? (
            <p className="rounded-xl bg-wax-soft/60 p-4 text-sm">This section shows real customer reviews you mark “Show on homepage” in Reviews. It stays hidden until there is at least one.</p>
          ) : null}
        </div>

        <div className="space-y-5">
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={s.isVisible} onChange={(ev) => set("isVisible", ev.target.checked)} className="h-5 w-5 accent-olive" />
            <span className="font-medium">Show this section on the homepage</span>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <LocalDateTimeInput name="startsAt" label="Show from" defaultIso={initial.startsAt} hint="For seasonal banners." />
            <LocalDateTimeInput name="endsAt" label="Hide after" defaultIso={initial.endsAt} />
          </div>
          {f.image ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Image</p>
              {s.imageUrl ? (
                <div className="flex items-end gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.imageUrl} alt="" className="h-32 w-auto rounded-lg object-cover" />
                  <button type="button" className="text-sm text-wine underline" onClick={() => setS((p) => ({ ...p, imageId: null, imageUrl: null }))}>
                    Remove
                  </button>
                </div>
              ) : null}
              <ImageUploader purpose="content" multiple={false} compact label={s.imageUrl ? "Replace image" : "Upload image"} onUploaded={(asset) => setS((p) => ({ ...p, imageId: asset.id, imageUrl: asset.url }))} />
              {initial.type === "HERO" ? <p className="text-[0.8125rem] text-ink-soft">A tall photo (portrait) works best. Without one, an illustrated candle is shown.</p> : null}
            </div>
          ) : null}
        </div>
      </div>

      {f.items ? (
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">{f.items.label}</legend>
          {items.map((item, index) => (
            <div key={item.key} className="grid gap-3 rounded-xl bg-white/60 p-4 ring-1 ring-line/60 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="grid gap-3 sm:grid-cols-2">
                <input aria-label="Title" placeholder="Title" className={controlClass} value={item.title} maxLength={120} onChange={(ev) => setItems((l) => l.map((x, i) => (i === index ? { ...x, title: ev.target.value } : x)))} />
                {f.items?.withHref ? (
                  <input aria-label="Link" placeholder="https://instagram.com/p/…" className={controlClass} value={item.href} maxLength={300} onChange={(ev) => setItems((l) => l.map((x, i) => (i === index ? { ...x, href: ev.target.value } : x)))} />
                ) : null}
                {f.items?.withBody ? (
                  <textarea aria-label="Text" placeholder="Text" rows={2} className={cn(controlClass, "sm:col-span-2")} value={item.body} maxLength={600} onChange={(ev) => setItems((l) => l.map((x, i) => (i === index ? { ...x, body: ev.target.value } : x)))} />
                ) : null}
                {f.items?.withImage ? (
                  <div className="space-y-2 sm:col-span-2">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt="" className="h-24 w-24 rounded-lg object-cover" />
                    ) : null}
                    <ImageUploader purpose="content" multiple={false} compact label={item.imageUrl ? "Replace photo" : "Upload photo"} onUploaded={(asset) => setItems((l) => l.map((x, i) => (i === index ? { ...x, imageId: asset.id, imageUrl: asset.url } : x)))} />
                  </div>
                ) : null}
              </div>
              <div className="flex gap-1 sm:flex-col">
                <button type="button" disabled={index === 0} onClick={() => setItems((l) => { const n = [...l]; [n[index - 1], n[index]] = [n[index], n[index - 1]]; return n; })} className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-ink/5 disabled:opacity-30" aria-label="Move up">
                  <ArrowUpIcon size={16} />
                </button>
                <button type="button" disabled={index === items.length - 1} onClick={() => setItems((l) => { const n = [...l]; [n[index + 1], n[index]] = [n[index], n[index + 1]]; return n; })} className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-ink/5 disabled:opacity-30" aria-label="Move down">
                  <ArrowDownIcon size={16} />
                </button>
                <button type="button" onClick={() => setItems((l) => l.filter((_, i) => i !== index))} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-wine hover:bg-wine-soft" aria-label="Remove">
                  <TrashIcon size={16} />
                </button>
              </div>
            </div>
          ))}
          {items.length < 12 ? (
            <button type="button" onClick={() => setItems((l) => [...l, { key: key(), title: "", body: "", href: "", imageId: null, imageUrl: null }])} className={buttonClass("secondary", "sm")}>
              <PlusIcon size={16} /> Add
            </button>
          ) : null}
        </fieldset>
      ) : null}

      <SubmitButton pendingLabel="Saving…">Save section</SubmitButton>
    </form>
  );
}
