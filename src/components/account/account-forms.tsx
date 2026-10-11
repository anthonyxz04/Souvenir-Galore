"use client";

import { useActionState, useState } from "react";
import { changePasswordAction, deleteAccountAction, saveAddressAction, updateProfileAction } from "@/server/actions/account";
import { initialFormState } from "@/lib/validation/forms";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { buttonClass } from "@/components/ui/button";
import { CheckboxField, InputField, SelectField, TextareaField } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";

type Address = {
  id: string;
  label: string | null;
  recipientName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  instructions: string | null;
  deliveryZoneId: string | null;
  isDefault: boolean;
};

export function AddressDialog({ address, zones, trigger }: { address?: Address; zones: { id: string; name: string }[]; trigger: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(async (prev: Parameters<typeof saveAddressAction>[0], formData: FormData) => {
    const result = await saveAddressAction(prev, formData);
    if (result.status === "success") setOpen(false);
    return result;
  }, initialFormState);
  const v = state.values ?? {};
  const e = state.fieldErrors ?? {};
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={buttonClass(address ? "ghost" : "primary", "sm")}>{trigger}</DialogTrigger>
      <DialogContent title={address ? "Edit address" : "Add an address"}>
        <form action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
          {address ? <input type="hidden" name="addressId" value={address.id} /> : null}
          <FormMessage state={state} className="sm:col-span-2" />
          <InputField name="label" label="Label" optional placeholder="Home, Work, Mum's" defaultValue={v.label ?? address?.label ?? ""} error={e.label} containerClassName="sm:col-span-2" />
          <InputField name="recipientName" label="Recipient name" required autoComplete="name" defaultValue={v.recipientName ?? address?.recipientName} error={e.recipientName} />
          <InputField name="phone" label="Phone" required type="tel" autoComplete="tel" defaultValue={v.phone ?? address?.phone} error={e.phone} />
          <InputField name="line1" label="Street, building, floor" required autoComplete="address-line1" defaultValue={v.line1 ?? address?.line1} error={e.line1} containerClassName="sm:col-span-2" />
          <InputField name="line2" label="Landmark or apartment" optional autoComplete="address-line2" defaultValue={v.line2 ?? address?.line2 ?? ""} error={e.line2} containerClassName="sm:col-span-2" />
          <InputField name="city" label="Town / city" required autoComplete="address-level2" defaultValue={v.city ?? address?.city} error={e.city} />
          <InputField name="region" label="Area / district" optional defaultValue={v.region ?? address?.region ?? ""} error={e.region} />
          {zones.length ? (
            <SelectField
              name="zoneId"
              label="Delivery area"
              optional
              placeholder="Choose later"
              defaultValue={v.zoneId ?? address?.deliveryZoneId ?? ""}
              options={zones.map((z) => ({ value: z.id, label: z.name }))}
              containerClassName="sm:col-span-2"
            />
          ) : null}
          <TextareaField name="instructions" label="Delivery instructions" optional rows={2} defaultValue={v.instructions ?? address?.instructions ?? ""} containerClassName="sm:col-span-2" />
          <CheckboxField name="isDefault" label="Use as my default address" defaultChecked={address?.isDefault} className="sm:col-span-2" />
          <div className="sm:col-span-2">
            <SubmitButton pendingLabel="Saving…">Save address</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ProfileForm({ name, phone, marketingOptIn }: { name: string; phone: string | null; marketingOptIn: boolean }) {
  const [state, action] = useActionState(updateProfileAction, initialFormState);
  return (
    <form action={action} className="max-w-lg space-y-5" noValidate>
      <FormMessage state={state} />
      <InputField name="name" label="Full name" required autoComplete="name" defaultValue={state.values?.name ?? name} error={state.fieldErrors?.name} />
      <InputField name="phone" label="Phone" optional type="tel" autoComplete="tel" defaultValue={state.values?.phone ?? phone ?? ""} error={state.fieldErrors?.phone} />
      <CheckboxField name="marketingOptIn" label="Send me news about new collections and offers." defaultChecked={marketingOptIn} />
      <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action] = useActionState(changePasswordAction, initialFormState);
  return (
    <form action={action} className="max-w-lg space-y-5" noValidate key={state.status === "success" ? "done" : "form"}>
      <FormMessage state={state} />
      <InputField name="currentPassword" label="Current password" type="password" autoComplete="current-password" required error={state.fieldErrors?.currentPassword} />
      <InputField name="newPassword" label="New password" type="password" autoComplete="new-password" required hint="At least 10 characters." error={state.fieldErrors?.newPassword} />
      <InputField name="confirmPassword" label="Repeat new password" type="password" autoComplete="new-password" required error={state.fieldErrors?.confirmPassword} />
      <SubmitButton pendingLabel="Saving…">Change password</SubmitButton>
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, action] = useActionState(deleteAccountAction, initialFormState);
  return (
    <form action={action} className="max-w-lg space-y-4" noValidate>
      <FormMessage state={state} />
      <InputField name="password" label="Your password" type="password" autoComplete="current-password" required error={state.fieldErrors?.password} />
      <InputField name="confirm" label="Type DELETE to confirm" required autoComplete="off" error={state.fieldErrors?.confirm} />
      <SubmitButton variant="danger" pendingLabel="Deleting…">
        Delete my account
      </SubmitButton>
    </form>
  );
}
