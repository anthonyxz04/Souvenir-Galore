"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { addToCartAction } from "@/server/actions/cart";
import { toggleWishlistAction } from "@/server/actions/account";
import { convertForDisplay, formatMoney, type CurrencyConfig } from "@/lib/money";
import { initialFormState } from "@/lib/validation/forms";
import { cn } from "@/lib/utils";
import { buttonClass } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { CheckIcon, CopyIcon, HeartIcon, InstagramIcon, MailIcon, MinusIcon, PlusIcon, WhatsAppIcon } from "@/components/ui/icons";
import { InquiryDialog } from "./inquiry-dialog";

type Variant = {
  id: string;
  title: string;
  options: (string | null)[];
  price: number;
  compareAt: number | null;
  available: boolean;
  maxQuantity: number;
  stockLabel: string;
  status: string;
};

type Field = {
  id: string;
  label: string;
  type: "TEXT" | "TEXTAREA" | "DATE" | "SELECT";
  isRequired: boolean;
  maxLength: number | null;
  options: string[];
  priceDelta: number;
  placeholder: string | null;
  helpText: string | null;
};

export type PurchaseProduct = {
  id: string;
  name: string;
  slug: string;
  isQuote: boolean;
  allowInquiry: boolean;
  options: { name: string; values: string[] }[];
  variants: Variant[];
  personalizationFields: Field[];
};

const DEFAULT_MAX: Record<Field["type"], number> = { TEXT: 60, TEXTAREA: 300, DATE: 10, SELECT: 100 };

export function ProductPurchase({
  product,
  currency,
  wishlisted,
  signedIn,
  contact,
  productUrl,
  secondaryCurrency,
}: {
  product: PurchaseProduct;
  currency: CurrencyConfig;
  wishlisted: boolean;
  signedIn: boolean;
  contact: { whatsapp: string; instagram: string; email: string };
  productUrl: string;
  secondaryCurrency: (CurrencyConfig & { rate: number }) | null;
}) {
  const initialVariant = product.variants.find((v) => v.available) ?? product.variants[0];
  const [selected, setSelected] = useState<(string | null)[]>(initialVariant?.options ?? []);
  const [quantity, setQuantity] = useState(1);
  const [values, setValues] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [state, formAction] = useActionState(addToCartAction, initialFormState);

  // Pre-fill the first name field with the name typed on the homepage gift tag.
  useEffect(() => {
    const firstText = product.personalizationFields.find((f) => f.type === "TEXT");
    if (!firstText) return;
    try {
      const saved = window.sessionStorage.getItem("sg-name");
      if (saved) setValues((v) => (v[firstText.id] ? v : { ...v, [firstText.id]: saved.slice(0, firstText.maxLength ?? DEFAULT_MAX.TEXT) }));
    } catch {
      /* storage unavailable */
    }
  }, [product.personalizationFields]);

  const variant = useMemo(
    () => product.variants.find((v) => product.options.every((_, i) => v.options[i] === selected[i])) ?? (product.options.length === 0 ? product.variants[0] : undefined),
    [product.variants, product.options, selected],
  );

  const surcharge = product.personalizationFields.reduce((sum, field) => sum + (values[field.id]?.trim() ? Math.max(0, field.priceDelta) : 0), 0);
  const unitPrice = variant ? variant.price + surcharge : null;
  const maxQuantity = variant?.maxQuantity ?? 1;

  useEffect(() => {
    setQuantity((q) => Math.min(Math.max(1, q), Math.max(1, maxQuantity)));
  }, [maxQuantity]);

  function isValueAvailable(optionIndex: number, value: string) {
    return product.variants.some(
      (v) => v.available && v.options[optionIndex] === value && product.options.every((_, i) => i === optionIndex || !selected[i] || v.options[i] === selected[i]),
    );
  }

  function selectValue(optionIndex: number, value: string) {
    const next = [...selected];
    next[optionIndex] = value;
    // If the combination doesn't exist, pick the closest available one that keeps this choice.
    const exact = product.variants.find((v) => product.options.every((_, i) => v.options[i] === next[i]));
    if (!exact) {
      const fallback = product.variants.find((v) => v.options[optionIndex] === value && v.available) ?? product.variants.find((v) => v.options[optionIndex] === value);
      if (fallback) {
        setSelected(fallback.options);
        return;
      }
    }
    setSelected(next);
  }

  const personalizationSummary = product.personalizationFields
    .filter((f) => values[f.id]?.trim())
    .map((f) => `${f.label}: ${values[f.id].trim()}`)
    .join("\n");
  const inquiryText = [
    `Hello! I'd like to ask about "${product.name}".`,
    variant && variant.title !== "Default" ? `Option: ${variant.title}` : null,
    `Quantity: ${quantity}`,
    personalizationSummary ? `Personalization:\n${personalizationSummary}` : null,
    productUrl,
  ]
    .filter(Boolean)
    .join("\n");

  async function copyDetails() {
    try {
      await navigator.clipboard.writeText(inquiryText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  const hasContact = Boolean(contact.whatsapp || contact.instagram || contact.email);

  return (
    <div className="space-y-6">
      <div>
        {product.isQuote ? (
          <p className="text-xl text-ink">Price on request</p>
        ) : unitPrice !== null ? (
          <div className="space-y-1">
            <p className="flex flex-wrap items-baseline gap-x-3 text-2xl text-ink">
              <span className={variant?.compareAt ? "text-wine" : undefined}>{formatMoney(unitPrice, currency)}</span>
              {variant?.compareAt ? (
                <s className="text-lg text-ink-soft">
                  <span className="sr-only">Regular price </span>
                  {formatMoney(variant.compareAt + surcharge, currency)}
                </s>
              ) : null}
            </p>
            {surcharge > 0 ? <p className="text-sm text-ink-soft">Includes {formatMoney(surcharge, currency)} for personalization</p> : null}
            {secondaryCurrency ? (
              <p className="text-sm text-ink-soft">≈ {formatMoney(convertForDisplay(unitPrice, currency, secondaryCurrency.rate, secondaryCurrency), secondaryCurrency)}</p>
            ) : null}
          </div>
        ) : (
          <p className="text-ink-soft">Choose an option to see the price.</p>
        )}
      </div>

      {product.isQuote ? (
        <div className="space-y-3">
          <p className="text-[0.9375rem] text-ink-soft">This piece is made to your brief, so the price depends on size, quantity and details. Send a request and we&apos;ll reply with a quote — nothing is charged until you confirm.</p>
          <Link href={`/custom-order?product=${encodeURIComponent(product.slug)}`} className={buttonClass("primary", "lg", "w-full")}>
            Request a quote
          </Link>
        </div>
      ) : (
        <form action={formAction} className="space-y-6">
          <input type="hidden" name="variantId" value={variant?.id ?? ""} />
          <input type="hidden" name="productSlug" value={product.slug} />

          {product.options.map((option, optionIndex) => (
            <fieldset key={option.name} className="space-y-2.5">
              <legend className="text-sm font-medium text-ink">
                {option.name}
                {selected[optionIndex] ? <span className="font-normal text-ink-soft">: {selected[optionIndex]}</span> : null}
              </legend>
              <div className="flex flex-wrap gap-2">
                {option.values.map((value) => {
                  const available = isValueAvailable(optionIndex, value);
                  const checked = selected[optionIndex] === value;
                  return (
                    <label
                      key={value}
                      className={cn(
                        "relative inline-flex min-h-11 cursor-pointer items-center rounded-full px-4 text-[0.9375rem] ring-1 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-olive",
                        checked ? "bg-ink text-white ring-ink" : "bg-plaster text-ink ring-line-strong/70 hover:ring-ink/60",
                        !available && !checked && "text-ink-soft line-through decoration-ink-soft/60",
                      )}
                    >
                      <input type="radio" name={`option-${optionIndex}`} value={value} checked={checked} onChange={() => selectValue(optionIndex, value)} className="sr-only" />
                      {value}
                      {!available ? <span className="sr-only"> (sold out)</span> : null}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}

          {product.personalizationFields.length ? (
            <fieldset className="space-y-4 rounded-2xl bg-plaster p-4 sm:p-5">
              <legend className="sr-only">Personalization</legend>
              <p className="font-display text-xl text-ink" aria-hidden>
                Personalize it
              </p>
              {product.personalizationFields.map((field) => {
                const id = `p-${field.id}`;
                const max = field.maxLength ?? DEFAULT_MAX[field.type];
                const error = state.fieldErrors?.[`p_${field.id}`];
                const describedBy = [field.helpText ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
                const common = {
                  id,
                  name: `p_${field.id}`,
                  value: values[field.id] ?? "",
                  required: field.isRequired,
                  "aria-describedby": describedBy,
                  "aria-invalid": error ? true : undefined,
                  onChange: (event: { target: { value: string } }) => setValues((v) => ({ ...v, [field.id]: event.target.value })),
                };
                return (
                  <div key={field.id} className="space-y-1.5">
                    <label htmlFor={id} className="flex items-baseline justify-between gap-2 text-sm font-medium text-ink">
                      <span>
                        {field.label}
                        {field.priceDelta > 0 ? <span className="font-normal text-ink-soft"> (+{formatMoney(field.priceDelta, currency)})</span> : null}
                      </span>
                      {!field.isRequired ? <span className="text-xs font-normal text-ink-soft">Optional</span> : null}
                    </label>
                    {field.type === "TEXTAREA" ? (
                      <textarea {...common} rows={3} maxLength={max} placeholder={field.placeholder ?? undefined} className={cn(controlClass, "bg-white")} />
                    ) : field.type === "SELECT" ? (
                      <select {...common} className={cn(controlClass, "bg-white")}>
                        <option value="">{field.isRequired ? "Choose…" : "No preference"}</option>
                        {field.options.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input {...common} type={field.type === "DATE" ? "date" : "text"} maxLength={max} placeholder={field.placeholder ?? undefined} className={cn(controlClass, "bg-white")} />
                    )}
                    <div className="flex justify-between gap-3 text-[0.8125rem] text-ink-soft">
                      {field.helpText ? <p id={`${id}-hint`}>{field.helpText}</p> : <span />}
                      {field.type === "TEXT" || field.type === "TEXTAREA" ? (
                        <span aria-hidden>
                          {(values[field.id] ?? "").length}/{max}
                        </span>
                      ) : null}
                    </div>
                    {error ? (
                      <p id={`${id}-error`} className="text-[0.8125rem] text-wine">
                        {error}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </fieldset>
          ) : null}

          {variant ? (
            <p className={cn("text-sm", variant.available ? (variant.status === "low_stock" ? "text-wax-ink" : "text-olive") : "text-wine")}>{variant.stockLabel}</p>
          ) : null}

          <div className="flex gap-3">
            <div className="inline-flex h-13 items-center rounded-full ring-1 ring-line-strong/70">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="inline-flex h-13 w-12 items-center justify-center rounded-l-full hover:bg-ink/5 disabled:opacity-40"
                disabled={quantity <= 1}
                aria-label="Decrease quantity"
              >
                <MinusIcon size={18} />
              </button>
              <label htmlFor="quantity" className="sr-only">
                Quantity
              </label>
              <input
                id="quantity"
                name="quantity"
                type="number"
                inputMode="numeric"
                min={1}
                max={maxQuantity}
                value={quantity}
                onChange={(event) => setQuantity(Math.min(maxQuantity, Math.max(1, Number(event.target.value) || 1)))}
                className="h-13 w-12 bg-transparent text-center text-base [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
                className="inline-flex h-13 w-12 items-center justify-center rounded-r-full hover:bg-ink/5 disabled:opacity-40"
                disabled={quantity >= maxQuantity}
                aria-label="Increase quantity"
              >
                <PlusIcon size={18} />
              </button>
            </div>
            <SubmitButton size="lg" className="flex-1" disabled={!variant?.available} pendingLabel="Adding…">
              {variant?.available === false ? "Sold out" : "Add to cart"}
            </SubmitButton>
          </div>

          {state.status === "success" ? (
            <div role="status" className="flex items-center justify-between gap-3 rounded-xl bg-olive-soft px-4 py-3 text-[0.9375rem] text-olive">
              <span className="inline-flex items-center gap-2">
                <CheckIcon size={18} /> {state.message}
              </span>
              <Link href="/cart" className="font-medium underline underline-offset-4">
                View cart
              </Link>
            </div>
          ) : (
            <FormMessage state={state} />
          )}
        </form>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {signedIn ? (
          <form action={toggleWishlistAction}>
            <input type="hidden" name="productId" value={product.id} />
            <input type="hidden" name="returnTo" value={`/products/${product.slug}`} />
            <button type="submit" className={buttonClass("secondary", "md")} aria-pressed={wishlisted}>
              <HeartIcon size={18} filled={wishlisted} className={wishlisted ? "text-wine" : undefined} />
              {wishlisted ? "Saved to wishlist" : "Save to wishlist"}
            </button>
          </form>
        ) : (
          <Link href={`/login?next=${encodeURIComponent(`/products/${product.slug}`)}`} className={buttonClass("secondary", "md")}>
            <HeartIcon size={18} /> Save to wishlist
          </Link>
        )}
      </div>

      {product.allowInquiry ? (
        <div className="space-y-3 rounded-2xl ring-1 ring-line p-4 sm:p-5">
          <p className="font-medium text-ink">Questions, a different color, or a larger quantity?</p>
          <div className="flex flex-wrap gap-2">
            {contact.whatsapp ? (
              <a href={`https://wa.me/${contact.whatsapp}?text=${encodeURIComponent(inquiryText)}`} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm")}>
                <WhatsAppIcon size={17} /> WhatsApp
              </a>
            ) : null}
            {contact.instagram ? (
              <a href={`https://ig.me/m/${contact.instagram}`} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm")} onClick={copyDetails}>
                <InstagramIcon size={17} /> Instagram
              </a>
            ) : null}
            {contact.email ? (
              <a
                href={`mailto:${contact.email}?subject=${encodeURIComponent(`Question about ${product.name}`)}&body=${encodeURIComponent(inquiryText)}`}
                className={buttonClass("secondary", "sm")}
              >
                <MailIcon size={17} /> Email
              </a>
            ) : null}
            <InquiryDialog productId={product.id} productName={product.name} variantTitle={variant && variant.title !== "Default" ? variant.title : null} quantity={quantity} personalization={personalizationSummary} />
            {hasContact ? (
              <button type="button" onClick={copyDetails} className={buttonClass("ghost", "sm")}>
                {copied ? <CheckIcon size={17} /> : <CopyIcon size={17} />}
                {copied ? "Details copied" : "Copy details"}
              </button>
            ) : null}
          </div>
          <p className="text-[0.8125rem] text-ink-soft">A message is a question, not an order. We&apos;ll confirm availability, price and timing before anything is made or paid.</p>
        </div>
      ) : null}
    </div>
  );
}
