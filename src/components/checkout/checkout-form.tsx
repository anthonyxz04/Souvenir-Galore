"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { placeOrderAction } from "@/server/actions/checkout";
import { computeTotals } from "@/lib/cart/totals";
import type { DiscountRule } from "@/lib/discounts/evaluate";
import type { FulfillmentMethod, PaymentMethodType } from "@/lib/domain";
import { formatMoney, type CurrencyConfig } from "@/lib/money";
import { isMethodAvailable } from "@/lib/payments/rules";
import type { MediaRef } from "@/lib/storage/urls";
import { initialFormState } from "@/lib/validation/forms";
import { cn } from "@/lib/utils";
import { CheckboxField, InputField, SelectField, TextareaField } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { StoreIcon, TruckIcon } from "@/components/ui/icons";
import { ImagePlaceholder, ResponsiveImage } from "@/components/ui/responsive-image";
import { SubmitButton } from "@/components/ui/submit-button";

type Line = {
  id: string;
  name: string;
  variantTitle: string | null;
  quantity: number;
  unitPrice: number;
  personalizationPrice: number;
  lineTotal: number;
  personalization: { label: string; value: string }[];
  image: (MediaRef & { alt: string }) | null;
};
type Zone = { id: string; name: string; description: string | null; fee: number; freeAboveSubtotal: number | null; minDays: number | null; maxDays: number | null };
type Method = {
  id: string;
  type: PaymentMethodType;
  name: string;
  description: string | null;
  instructions: string | null;
  details: { label: string; value: string }[];
  requiresManualVerification: boolean;
  isEnabled: boolean;
  availableForDelivery: boolean;
  availableForPickup: boolean;
  minOrderTotal: number | null;
  maxOrderTotal: number | null;
};
type SavedAddress = { id: string; label: string | null; recipientName: string; phone: string; line1: string; line2: string | null; city: string; region: string | null; deliveryZoneId: string | null };

const radioCard =
  "relative flex cursor-pointer gap-3 rounded-2xl bg-white p-4 ring-1 ring-line-strong/60 transition-colors has-[:checked]:ring-2 has-[:checked]:ring-olive has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-olive";

function Section({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`checkout-step-${step}`} className="space-y-5 border-t border-line pt-8 first:border-t-0 first:pt-0">
      <h2 id={`checkout-step-${step}`} className="flex items-baseline gap-3 font-display text-2xl text-ink">
        <span className="text-base text-wax-ink" aria-hidden>
          {step}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function CheckoutForm({
  base,
  currency,
  lines,
  discount,
  tax,
  zones,
  pickup,
  methods,
  user,
  addresses,
  requireTerms,
}: {
  base: string;
  currency: CurrencyConfig;
  lines: Line[];
  discount: { rule: DiscountRule; label: string } | null;
  tax: { enabled: boolean; rateBps: number; included: boolean; label: string };
  zones: Zone[];
  pickup: { locationName: string; address: string; hours: string; instructions: string } | null;
  methods: Method[];
  user: { name: string; email: string; phone: string | null } | null;
  addresses: SavedAddress[];
  requireTerms: boolean;
}) {
  const [state, action] = useActionState(placeOrderAction, initialFormState);
  const v = state.values ?? {};
  const e = state.fieldErrors ?? {};
  const fmt = (minor: number) => formatMoney(minor, currency);

  const [fulfillment, setFulfillment] = useState<FulfillmentMethod>((v.fulfillment as FulfillmentMethod) || (zones.length ? "DELIVERY" : "PICKUP"));
  const defaultAddress = addresses[0];
  const [savedAddressId, setSavedAddressId] = useState<string>(v.savedAddressId ?? defaultAddress?.id ?? "");
  const savedAddress = addresses.find((a) => a.id === savedAddressId);
  const [zoneId, setZoneId] = useState<string>(v.zoneId ?? savedAddress?.deliveryZoneId ?? (zones.length === 1 ? zones[0].id : ""));
  const zone = zones.find((z) => z.id === zoneId) ?? null;
  const [paymentMethodId, setPaymentMethodId] = useState<string>(v.paymentMethodId ?? "");

  const totals = useMemo(
    () =>
      computeTotals({
        lines: lines.map((line) => ({ unitPrice: line.unitPrice, personalizationPrice: line.personalizationPrice, quantity: line.quantity })),
        discount: discount?.rule ?? null,
        delivery: fulfillment === "DELIVERY" ? (zone ? { fee: zone.fee, freeAboveSubtotal: zone.freeAboveSubtotal } : { fee: 0, freeAboveSubtotal: null }) : null,
        tax,
      }),
    [lines, discount, fulfillment, zone, tax],
  );

  const availableMethods = methods.filter((m) => isMethodAvailable(m, { fulfillment, total: totals.total }));
  const selectedMethod = availableMethods.find((m) => m.id === paymentMethodId) ?? (availableMethods.length === 1 ? availableMethods[0] : undefined);
  const deliveryReady = fulfillment === "PICKUP" || Boolean(zone);

  return (
    <form action={action} className="mt-10 grid gap-10 lg:grid-cols-12 lg:gap-14" noValidate>
      <input type="hidden" name="expectedTotal" value={deliveryReady ? totals.total : ""} />
      <div className="space-y-10 lg:col-span-7">
        <FormMessage state={state} />

        <Section step={1} title="Your details">
          {!user ? (
            <p className="text-[0.9375rem] text-ink-soft">
              Have an account?{" "}
              <Link href="/login?next=/checkout" className="text-olive underline underline-offset-4">
                Sign in
              </Link>{" "}
              for saved addresses — or continue as a guest.
            </p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <InputField
              name="email"
              label="Email"
              type="email"
              autoComplete="email"
              required
              defaultValue={user?.email ?? v.email}
              readOnly={Boolean(user)}
              hint={user ? "Order updates go to your account email." : "For your order confirmation and updates."}
              error={e.email}
              containerClassName="sm:col-span-2"
            />
            <InputField name="name" label="Full name" autoComplete="name" required defaultValue={v.name ?? user?.name} error={e.name} />
            <InputField name="phone" label="Phone" type="tel" autoComplete="tel" required defaultValue={v.phone ?? user?.phone ?? ""} error={e.phone} hint="We call only if there's a question about your order." />
          </div>
        </Section>

        <Section step={2} title="Delivery or pickup">
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="sr-only">How would you like to receive your order?</legend>
            {zones.length ? (
              <label className={radioCard}>
                <input type="radio" name="fulfillment" value="DELIVERY" checked={fulfillment === "DELIVERY"} onChange={() => setFulfillment("DELIVERY")} className="mt-1 h-4 w-4 accent-olive" />
                <span className="space-y-0.5">
                  <span className="flex items-center gap-2 font-medium">
                    <TruckIcon size={18} /> Delivery
                  </span>
                  <span className="block text-sm text-ink-soft">To your door in Lebanon</span>
                </span>
              </label>
            ) : null}
            {pickup ? (
              <label className={radioCard}>
                <input type="radio" name="fulfillment" value="PICKUP" checked={fulfillment === "PICKUP"} onChange={() => setFulfillment("PICKUP")} className="mt-1 h-4 w-4 accent-olive" />
                <span className="space-y-0.5">
                  <span className="flex items-center gap-2 font-medium">
                    <StoreIcon size={18} /> Pickup
                  </span>
                  <span className="block text-sm text-ink-soft">{pickup.locationName || "Collect from our workshop"} — free</span>
                </span>
              </label>
            ) : null}
          </fieldset>
          {e.fulfillment ? <p className="text-sm text-wine">{e.fulfillment}</p> : null}

          {fulfillment === "PICKUP" && pickup ? (
            <div className="rounded-2xl bg-plaster p-4 text-[0.9375rem] leading-relaxed">
              {pickup.address ? <p className="whitespace-pre-line">{pickup.address}</p> : null}
              {pickup.hours ? <p className="mt-1 whitespace-pre-line text-ink-soft">{pickup.hours}</p> : null}
              {pickup.instructions ? <p className="mt-2 whitespace-pre-line text-ink-soft">{pickup.instructions}</p> : null}
              <p className="mt-2 text-ink-soft">We&apos;ll message you when your order is ready to collect.</p>
            </div>
          ) : null}

          {fulfillment === "DELIVERY" ? (
            <div className="space-y-5">
              {addresses.length ? (
                <fieldset className="space-y-2.5">
                  <legend className="mb-2 text-sm font-medium text-ink">Deliver to</legend>
                  {addresses.map((address) => (
                    <label key={address.id} className={radioCard}>
                      <input
                        type="radio"
                        name="savedAddressId"
                        value={address.id}
                        checked={savedAddressId === address.id}
                        onChange={() => {
                          setSavedAddressId(address.id);
                          if (address.deliveryZoneId) setZoneId(address.deliveryZoneId);
                        }}
                        className="mt-1 h-4 w-4 accent-olive"
                      />
                      <span className="text-[0.9375rem]">
                        <span className="font-medium">{address.label || address.recipientName}</span>
                        <span className="block text-ink-soft">
                          {[address.line1, address.line2, address.city, address.region].filter(Boolean).join(", ")}
                        </span>
                      </span>
                    </label>
                  ))}
                  <label className={radioCard}>
                    <input type="radio" name="savedAddressId" value="" checked={savedAddressId === ""} onChange={() => setSavedAddressId("")} className="mt-1 h-4 w-4 accent-olive" />
                    <span className="font-medium">Use a new address</span>
                  </label>
                </fieldset>
              ) : null}

              {savedAddressId === "" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <InputField name="recipientName" label="Recipient name" autoComplete="name" defaultValue={v.recipientName ?? user?.name} error={e.recipientName} />
                  <InputField name="addressPhone" label="Recipient phone" type="tel" autoComplete="tel" defaultValue={v.addressPhone ?? user?.phone ?? ""} error={e.addressPhone} />
                  <InputField name="line1" label="Street, building, floor" autoComplete="address-line1" defaultValue={v.line1} error={e.line1} containerClassName="sm:col-span-2" />
                  <InputField name="line2" label="Landmark or apartment" autoComplete="address-line2" optional defaultValue={v.line2} error={e.line2} containerClassName="sm:col-span-2" />
                  <InputField name="city" label="Town / city" autoComplete="address-level2" defaultValue={v.city} error={e.city} />
                  <InputField name="region" label="Area / district" autoComplete="address-level1" optional defaultValue={v.region} error={e.region} />
                  {user ? <CheckboxField name="saveAddress" label="Save this address to my account" defaultChecked className="sm:col-span-2" /> : null}
                </div>
              ) : null}

              <SelectField
                name="zoneId"
                label="Delivery area"
                value={zoneId}
                onChange={(event) => setZoneId(event.target.value)}
                placeholder="Choose your area"
                options={zones.map((z) => ({
                  value: z.id,
                  label: `${z.name}: ${z.fee === 0 ? "free delivery" : fmt(z.fee)}${z.minDays || z.maxDays ? `, ${z.minDays && z.maxDays && z.minDays !== z.maxDays ? `${z.minDays}–${z.maxDays}` : z.maxDays ?? z.minDays} days` : ""}`,
                }))}
                error={e.zoneId}
                hint={zone?.freeAboveSubtotal ? `Free delivery to ${zone.name} on orders over ${fmt(zone.freeAboveSubtotal)}.` : zone?.description ?? undefined}
              />
              <TextareaField name="instructions" label="Delivery instructions" optional rows={2} defaultValue={v.instructions} error={e.instructions} placeholder="Best time to call, building entrance…" />
            </div>
          ) : null}
        </Section>

        <Section step={3} title="Payment">
          {availableMethods.length === 0 ? (
            <p className="text-[0.9375rem] text-wine">No payment method is available for this order. Try a different delivery option, or contact us.</p>
          ) : (
            <fieldset className="space-y-2.5">
              <legend className="sr-only">Payment method</legend>
              {availableMethods.map((method) => (
                <label key={method.id} className={radioCard}>
                  <input
                    type="radio"
                    name="paymentMethodId"
                    value={method.id}
                    checked={selectedMethod?.id === method.id}
                    onChange={() => setPaymentMethodId(method.id)}
                    className="mt-1 h-4 w-4 accent-olive"
                  />
                  <span className="space-y-0.5 text-[0.9375rem]">
                    <span className="block font-medium">{method.name}</span>
                    {method.description ? <span className="block text-ink-soft">{method.description}</span> : null}
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          {e.paymentMethodId ? <p className="text-sm text-wine">{e.paymentMethodId}</p> : null}
          {selectedMethod && selectedMethod.type !== "CASH_ON_DELIVERY" ? (
            <div className="space-y-2 rounded-2xl bg-wax-soft/60 p-4 text-[0.9375rem] leading-relaxed">
              <p className="font-medium">How paying with {selectedMethod.name} works</p>
              <p>After you place your order, you&apos;ll see the payment details and can send the amount. Use your order number as the reference.</p>
              {selectedMethod.requiresManualVerification ? (
                <p className="text-ink-soft">Your order is marked as paid only after we confirm we&apos;ve received the money.</p>
              ) : null}
            </div>
          ) : null}
        </Section>

        <Section step={4} title="Anything else?">
          <TextareaField name="customerNote" label="Note for the workshop" optional rows={3} maxLength={1000} defaultValue={v.customerNote} error={e.customerNote} placeholder="A gift message, a date you need it by…" />
          {requireTerms ? (
            <CheckboxField
              name="acceptTerms"
              label={
                <>
                  I agree to the{" "}
                  <Link href="/pages/terms-and-conditions" target="_blank" className="underline underline-offset-4">
                    terms
                  </Link>
                  ,{" "}
                  <Link href="/pages/returns-and-refunds" target="_blank" className="underline underline-offset-4">
                    returns policy
                  </Link>{" "}
                  and{" "}
                  <Link href="/pages/privacy-policy" target="_blank" className="underline underline-offset-4">
                    privacy policy
                  </Link>
                  .
                </>
              }
              error={e.acceptTerms}
            />
          ) : (
            <input type="hidden" name="acceptTerms" value="on" />
          )}
        </Section>
      </div>

      <aside aria-label="Order review" className="lg:col-span-5">
        <div className="space-y-5 rounded-2xl bg-plaster p-6 lg:sticky lg:top-28">
          <h2 className="font-display text-2xl">Review your order</h2>
          <ul className="space-y-4">
            {lines.map((line) => (
              <li key={line.id} className="flex gap-3">
                <div className="relative h-16 w-14 shrink-0 overflow-hidden rounded-md bg-limestone-deep">
                  {line.image ? <ResponsiveImage media={line.image} base={base} alt="" sizes="56px" className="h-full w-full object-cover" /> : <ImagePlaceholder />}
                  <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[0.6875rem] text-white">{line.quantity}</span>
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium text-ink">{line.name}</p>
                  {line.variantTitle ? <p className="text-ink-soft">{line.variantTitle}</p> : null}
                  {line.personalization.map((p) => (
                    <p key={p.label} className="truncate text-ink-soft">
                      {p.label}: {p.value}
                    </p>
                  ))}
                </div>
                <p className="text-sm">{fmt(line.lineTotal)}</p>
              </li>
            ))}
          </ul>
          <dl className="space-y-2.5 border-t border-line pt-4 text-[0.9375rem]">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>{fmt(totals.subtotal)}</dd>
            </div>
            {discount && totals.discountTotal > 0 ? (
              <div className="flex justify-between text-olive">
                <dt>{discount.label}</dt>
                <dd>−{fmt(totals.discountTotal)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt>{fulfillment === "PICKUP" ? "Pickup" : "Delivery"}</dt>
              <dd>{fulfillment === "PICKUP" ? "Free" : zone ? (totals.deliveryFee === 0 ? "Free" : fmt(totals.deliveryFee)) : "Choose an area"}</dd>
            </div>
            {tax.enabled && totals.taxTotal > 0 ? (
              <div className="flex justify-between text-ink-soft">
                <dt>
                  {tax.label}
                  {totals.taxIncluded ? " (included)" : ""}
                </dt>
                <dd>{fmt(totals.taxTotal)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-line pt-3 text-lg font-medium">
              <dt>Total</dt>
              <dd>{fmt(totals.total)}</dd>
            </div>
          </dl>
          <SubmitButton size="lg" className="w-full" disabled={!deliveryReady || availableMethods.length === 0} pendingLabel="Placing order…">
            Place order — {fmt(totals.total)}
          </SubmitButton>
          <p className={cn("text-center text-[0.8125rem] text-ink-soft")}>
            {selectedMethod?.type === "CASH_ON_DELIVERY"
              ? "You'll pay when your order is delivered or collected."
              : "Nothing is charged automatically. You'll see how to pay on the next page."}
          </p>
        </div>
      </aside>
    </form>
  );
}
