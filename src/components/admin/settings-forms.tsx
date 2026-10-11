"use client";

import { useState } from "react";
import { saveDeliveryZoneAction, saveSettingsAction } from "@/server/actions/admin/store";
import type { AllSettings } from "@/lib/settings";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { buttonClass, type ButtonVariant } from "@/components/ui/button";
import { InputField, SelectField, TextareaField } from "@/components/ui/field";
import { Notice } from "@/components/ui/form-message";
import { AdminForm, Toggle } from "./admin-form";
import { SingleImageField } from "./single-image-field";
import type { FormState } from "@/lib/validation/forms";

function Group({ group, children, submitLabel }: { group: string; children: (state: FormState) => React.ReactNode; submitLabel?: string }) {
  return (
    <AdminForm action={saveSettingsAction} submitLabel={submitLabel}>
      {(state) => (
        <>
          <input type="hidden" name="group" value={group} />
          {children(state)}
        </>
      )}
    </AdminForm>
  );
}

export function StoreSettingsForm({ settings, logoUrl }: { settings: AllSettings["store"]; logoUrl: string | null }) {
  return (
    <Group group="store">
      {(s) => (
        <>
          <InputField name="name" label="Business name" required maxLength={80} defaultValue={s.values?.name ?? settings.name} error={s.fieldErrors?.name} />
          <InputField name="tagline" label="Tagline" optional maxLength={140} defaultValue={s.values?.tagline ?? settings.tagline} hint="Shown in the footer." />
          <TextareaField name="description" label="Short description" optional rows={2} maxLength={300} defaultValue={s.values?.description ?? settings.description} hint="Used for search engines and sharing." />
          <SingleImageField name="logoAssetId" label="Logo (optional — replaces the built-in wordmark)" purpose="branding" initialId={settings.logoAssetId} initialUrl={logoUrl} />
        </>
      )}
    </Group>
  );
}

export function ContactSettingsForm({ settings }: { settings: AllSettings["contact"] }) {
  return (
    <Group group="contact">
      {(s) => (
        <>
          <Notice tone="warning">Only enter real contact details you want customers to use. Empty fields are hidden in the store.</Notice>
          <div className="grid gap-5 sm:grid-cols-2">
            <InputField name="email" label="Email" optional type="email" defaultValue={s.values?.email ?? settings.email} error={s.fieldErrors?.email} />
            <InputField name="phone" label="Phone" optional defaultValue={s.values?.phone ?? settings.phone} error={s.fieldErrors?.phone} />
            <InputField name="whatsapp" label="WhatsApp number" optional inputMode="numeric" defaultValue={s.values?.whatsapp ?? settings.whatsapp} error={s.fieldErrors?.whatsapp} hint="With country code, digits only: 961 then the number." />
            <InputField name="instagram" label="Instagram username" optional defaultValue={s.values?.instagram ?? settings.instagram} error={s.fieldErrors?.instagram} hint="Without @" />
            <InputField name="facebookUrl" label="Facebook page link" optional type="url" defaultValue={s.values?.facebookUrl ?? settings.facebookUrl} error={s.fieldErrors?.facebookUrl} />
            <InputField name="tiktokUrl" label="TikTok link" optional type="url" defaultValue={s.values?.tiktokUrl ?? settings.tiktokUrl} error={s.fieldErrors?.tiktokUrl} />
          </div>
          <TextareaField name="address" label="Address or area" optional rows={2} defaultValue={s.values?.address ?? settings.address} />
          <TextareaField name="hours" label="Opening / reply hours" optional rows={2} defaultValue={s.values?.hours ?? settings.hours} />
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium">Contact buttons on product pages</legend>
            <Toggle name="showWhatsappButton" label="WhatsApp" description="Also shows a floating “Chat with us” button." defaultChecked={settings.showWhatsappButton} />
            <Toggle name="showInstagramButton" label="Instagram" defaultChecked={settings.showInstagramButton} />
            <Toggle name="showEmailButton" label="Email" defaultChecked={settings.showEmailButton} />
          </fieldset>
        </>
      )}
    </Group>
  );
}

export function CommerceSettingsForm({ settings, currencyLocked }: { settings: AllSettings["commerce"]; currencyLocked: boolean }) {
  return (
    <Group group="commerce">
      {(s) => {
        const e = s.fieldErrors ?? {};
        return (
          <div className="space-y-8">
            <fieldset className="space-y-4">
              <legend className="mb-1 font-semibold">Currency</legend>
              <div className="grid gap-4 sm:grid-cols-3">
                <InputField name="currencyCode" label="Store currency" maxLength={3} defaultValue={settings.currencyCode} readOnly={currencyLocked} error={e.currencyCode} hint={currencyLocked ? "Locked because products exist." : "e.g. USD"} />
                <SelectField name="currencyDecimals" label="Decimal places" defaultValue={String(settings.currencyDecimals)} disabled={currencyLocked} options={[{ value: "2", label: "2 (e.g. 12.50)" }, { value: "0", label: "0 (e.g. 450,000)" }]} />
                <InputField name="currencyLocale" label="Number format" defaultValue={settings.currencyLocale} hint="en-US shows $1,234.50" />
              </div>
              {currencyLocked ? <input type="hidden" name="currencyDecimals" value={settings.currencyDecimals} /> : null}
              <Toggle name="secondaryCurrencyEnabled" label="Show an approximate price in a second currency" description="Display only, e.g. LBP. Orders are always charged in the store currency." defaultChecked={settings.secondaryCurrencyEnabled} />
              <div className="grid gap-4 sm:grid-cols-3">
                <InputField name="secondaryCurrencyCode" label="Second currency" maxLength={3} defaultValue={settings.secondaryCurrencyCode} />
                <InputField name="secondaryCurrencyDecimals" label="Decimal places" type="number" min={0} max={3} defaultValue={String(settings.secondaryCurrencyDecimals)} />
                <InputField name="secondaryCurrencyRate" label="Rate (per 1 store unit)" inputMode="decimal" defaultValue={String(settings.secondaryCurrencyRate)} hint="Keep this up to date yourself." error={e.secondaryCurrencyRate} />
              </div>
            </fieldset>

            <fieldset className="space-y-4">
              <legend className="mb-1 font-semibold">Tax</legend>
              <Toggle name="taxEnabled" label="Charge or show tax" description="Check with your accountant whether you must charge VAT." defaultChecked={settings.taxEnabled} />
              <div className="grid gap-4 sm:grid-cols-3">
                <InputField name="taxLabel" label="Tax name" defaultValue={settings.taxLabel} />
                <InputField name="taxRatePercent" label="Rate (%)" inputMode="decimal" defaultValue={String(settings.taxRateBps / 100)} error={e.taxRatePercent} />
              </div>
              <Toggle name="taxIncluded" label="Prices already include tax" defaultChecked={settings.taxIncluded} />
            </fieldset>

            <fieldset className="space-y-4">
              <legend className="mb-1 font-semibold">Checkout</legend>
              <Toggle name="allowGuestCheckout" label="Allow checkout without an account" defaultChecked={settings.allowGuestCheckout} />
              <Toggle name="requireTermsAcceptance" label="Ask customers to accept terms at checkout" defaultChecked={settings.requireTermsAcceptance} />
              <div className="grid gap-4 sm:grid-cols-3">
                <InputField name="minOrderSubtotal" label="Minimum order" optional inputMode="decimal" defaultValue={settings.minOrderSubtotal ? String(settings.minOrderSubtotal / 10 ** settings.currencyDecimals) : ""} error={e.minOrderSubtotal} />
                <InputField name="maxQuantityPerLine" label="Max quantity per item" type="number" min={1} defaultValue={String(settings.maxQuantityPerLine)} />
              </div>
            </fieldset>

            <fieldset className="space-y-4">
              <legend className="mb-1 font-semibold">Catalog</legend>
              <div className="grid gap-4 sm:grid-cols-3">
                <InputField name="lowStockThreshold" label="Low-stock alert at" type="number" min={0} defaultValue={String(settings.lowStockThreshold)} />
                <InputField name="newBadgeDays" label="“New” badge for (days)" type="number" min={0} defaultValue={String(settings.newBadgeDays)} />
                <InputField name="budgetTiers" label="Gift finder budgets" defaultValue={settings.budgetTiers.join(", ")} hint="Whole amounts, e.g. 25, 50, 100" />
              </div>
              <Toggle name="reviewsEnabled" label="Product reviews" description="Reviews always need your approval before they appear." defaultChecked={settings.reviewsEnabled} />
              <Toggle name="customOrdersEnabled" label="Custom order requests" defaultChecked={settings.customOrdersEnabled} />
              <Toggle name="customOrderUploadsEnabled" label="Allow reference images on custom requests" defaultChecked={settings.customOrderUploadsEnabled} />
            </fieldset>
          </div>
        );
      }}
    </Group>
  );
}

export function AnnouncementForm({ settings }: { settings: AllSettings["announcement"] }) {
  return (
    <Group group="announcement">
      {(s) => (
        <>
          <Toggle name="enabled" label="Show the announcement bar" defaultChecked={settings.enabled} />
          <InputField name="message" label="Message" maxLength={160} defaultValue={s.values?.message ?? settings.message} placeholder="Free delivery in Beirut on orders over $50" />
          <InputField name="href" label="Link" optional defaultValue={s.values?.href ?? settings.href} placeholder="/collections/christmas" />
        </>
      )}
    </Group>
  );
}

export function NewsletterSettingsForm({ settings }: { settings: AllSettings["newsletter"] }) {
  return (
    <Group group="newsletter">
      {(s) => (
        <>
          <Toggle name="enabled" label="Accept newsletter signups" defaultChecked={settings.enabled} />
          <Toggle name="doubleOptIn" label="Ask subscribers to confirm by email" description="Recommended. Requires email (SMTP) to be configured; otherwise signups are confirmed immediately." defaultChecked={settings.doubleOptIn} />
          <InputField name="heading" label="Heading" maxLength={100} defaultValue={s.values?.heading ?? settings.heading} />
          <TextareaField name="body" label="Text" rows={2} maxLength={300} defaultValue={s.values?.body ?? settings.body} />
          <TextareaField name="consentText" label="Consent checkbox text" rows={2} maxLength={300} defaultValue={s.values?.consentText ?? settings.consentText} hint="Stored with each signup as a record of consent." />
        </>
      )}
    </Group>
  );
}

export function SeoSettingsForm({ settings }: { settings: AllSettings["seo"] }) {
  return (
    <Group group="seo">
      {(s) => (
        <>
          <InputField name="defaultTitle" label="Homepage title" maxLength={70} defaultValue={s.values?.defaultTitle ?? settings.defaultTitle} />
          <TextareaField name="defaultDescription" label="Homepage description" rows={2} maxLength={170} defaultValue={s.values?.defaultDescription ?? settings.defaultDescription} />
        </>
      )}
    </Group>
  );
}

export function PickupForm({ settings }: { settings: AllSettings["pickup"] }) {
  return (
    <Group group="pickup" submitLabel="Save pickup settings">
      {(s) => (
        <>
          <Toggle name="enabled" label="Offer pickup" description="Customers collect their order for free." defaultChecked={settings.enabled} />
          <InputField name="locationName" label="Pickup point name" optional maxLength={120} defaultValue={s.values?.locationName ?? settings.locationName} placeholder="Our workshop" />
          <TextareaField name="address" label="Address" optional rows={2} defaultValue={s.values?.address ?? settings.address} />
          <TextareaField name="hours" label="Pickup hours" optional rows={2} defaultValue={s.values?.hours ?? settings.hours} />
          <TextareaField name="instructions" label="Instructions" optional rows={2} defaultValue={s.values?.instructions ?? settings.instructions} placeholder="Message us when you're on your way." />
        </>
      )}
    </Group>
  );
}

export function DeliveryZoneDialog({
  zone,
  trigger,
  variant = "primary",
}: {
  zone?: { id: string; name: string; description: string; fee: string; freeAboveSubtotal: string; minDays: string; maxDays: string; isActive: boolean };
  trigger: string;
  variant?: ButtonVariant;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={buttonClass(variant, "sm")}>{trigger}</DialogTrigger>
      <DialogContent title={zone ? `Edit ${zone.name}` : "New delivery area"}>
        <AdminForm
          action={async (state, formData) => {
            const result = await saveDeliveryZoneAction(state, formData);
            if (result.status === "success") setOpen(false);
            return result;
          }}
        >
          {(s) => (
            <>
              {zone ? <input type="hidden" name="id" value={zone.id} /> : null}
              <InputField name="name" label="Area name" required maxLength={80} defaultValue={s.values?.name ?? zone?.name} error={s.fieldErrors?.name} />
              <InputField name="description" label="Note" optional maxLength={300} defaultValue={s.values?.description ?? zone?.description} placeholder="Towns or districts covered" />
              <div className="grid gap-4 sm:grid-cols-2">
                <InputField name="fee" label="Delivery fee" required inputMode="decimal" defaultValue={s.values?.fee ?? zone?.fee ?? ""} error={s.fieldErrors?.fee} />
                <InputField name="freeAboveSubtotal" label="Free above" optional inputMode="decimal" defaultValue={s.values?.freeAboveSubtotal ?? zone?.freeAboveSubtotal} error={s.fieldErrors?.freeAboveSubtotal} />
                <InputField name="minDays" label="Delivery days from" optional type="number" min={0} defaultValue={s.values?.minDays ?? zone?.minDays} error={s.fieldErrors?.minDays} />
                <InputField name="maxDays" label="to" optional type="number" min={0} defaultValue={s.values?.maxDays ?? zone?.maxDays} error={s.fieldErrors?.maxDays} />
              </div>
              <Toggle name="isActive" label="Deliver to this area" defaultChecked={zone?.isActive ?? true} />
            </>
          )}
        </AdminForm>
      </DialogContent>
    </Dialog>
  );
}
