"use client";

import { useState } from "react";
import { saveCategoryAction, saveCollectionAction, saveTagAction, saveTagGroupAction } from "@/server/actions/admin/catalog";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { buttonClass, type ButtonVariant } from "@/components/ui/button";
import { CheckboxField, InputField, SelectField, TextareaField } from "@/components/ui/field";
import { AdminForm } from "./admin-form";
import { SingleImageField } from "./single-image-field";
import type { FormState } from "@/lib/validation/forms";

type CategoryInitial = {
  id?: string;
  name?: string;
  slug?: string;
  parentId?: string | null;
  description?: string | null;
  imageId?: string | null;
  imageUrl?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  isPublished?: boolean;
  showInNav?: boolean;
};

function closeOnSuccess(action: (s: FormState, f: FormData) => Promise<FormState>, close: () => void) {
  return async (state: FormState, formData: FormData) => {
    const result = await action(state, formData);
    if (result.status === "success") close();
    return result;
  };
}

export function CategoryDialog({ initial, parents, trigger, variant = "primary" }: { initial: CategoryInitial; parents: { id: string; name: string; depth: number }[]; trigger: string; variant?: ButtonVariant }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={buttonClass(variant, "sm")}>{trigger}</DialogTrigger>
      <DialogContent title={initial.id ? `Edit ${initial.name}` : "New category"}>
        <AdminForm action={closeOnSuccess(saveCategoryAction, () => setOpen(false))} submitLabel={initial.id ? "Save category" : "Create category"}>
          {(state) => (
            <>
              {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
              <InputField name="name" label="Name" required maxLength={80} defaultValue={state.values?.name ?? initial.name} error={state.fieldErrors?.name} />
              <InputField name="slug" label="Web address" optional hint="Leave empty to create one from the name." defaultValue={state.values?.slug ?? initial.slug} error={state.fieldErrors?.slug} />
              <SelectField
                name="parentId"
                label="Inside"
                defaultValue={initial.parentId ?? ""}
                options={[{ value: "", label: "Top level" }, ...parents.filter((p) => p.id !== initial.id).map((p) => ({ value: p.id, label: `${"— ".repeat(p.depth)}${p.name}` }))]}
              />
              <TextareaField name="description" label="Description" optional rows={3} maxLength={1000} defaultValue={initial.description ?? ""} />
              <SingleImageField name="imageId" label="Image" purpose="categories" initialId={initial.imageId} initialUrl={initial.imageUrl} />
              <CheckboxField name="isPublished" label="Visible in the store" defaultChecked={initial.isPublished ?? true} />
              <CheckboxField name="showInNav" label="Show in the main menu" defaultChecked={initial.showInNav ?? true} />
              <details className="rounded-xl ring-1 ring-line">
                <summary className="px-4 py-2.5 text-sm">Search engine settings</summary>
                <div className="space-y-3 px-4 pb-4">
                  <InputField name="seoTitle" label="Page title" optional maxLength={70} defaultValue={initial.seoTitle ?? ""} />
                  <TextareaField name="seoDescription" label="Meta description" optional rows={2} maxLength={170} defaultValue={initial.seoDescription ?? ""} />
                </div>
              </details>
            </>
          )}
        </AdminForm>
      </DialogContent>
    </Dialog>
  );
}

type CollectionInitial = {
  id?: string;
  name?: string;
  slug?: string;
  description?: string | null;
  kind?: string;
  imageId?: string | null;
  imageUrl?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  isPublished?: boolean;
  isFeatured?: boolean;
};

export function CollectionForm({ initial }: { initial: CollectionInitial }) {
  return (
    <AdminForm action={saveCollectionAction} submitLabel={initial.id ? "Save collection" : "Create collection"}>
      {(state) => (
        <div className="grid gap-5 lg:grid-cols-2">
          {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
          <div className="space-y-5">
            <InputField name="name" label="Name" required maxLength={100} defaultValue={state.values?.name ?? initial.name} error={state.fieldErrors?.name} />
            <InputField name="slug" label="Web address" optional hint="Leave empty to create one from the name." defaultValue={state.values?.slug ?? initial.slug} error={state.fieldErrors?.slug} />
            <SelectField
              name="kind"
              label="Type"
              defaultValue={initial.kind ?? "STANDARD"}
              options={[
                { value: "STANDARD", label: "Collection" },
                { value: "SEASONAL", label: "Seasonal (Christmas, Easter…)" },
                { value: "OCCASION", label: "Occasion (weddings, baptisms…)" },
                { value: "LIMITED", label: "Limited edition" },
              ]}
            />
            <TextareaField name="description" label="Description" optional rows={4} maxLength={1000} defaultValue={initial.description ?? ""} />
            <div className="grid gap-4 sm:grid-cols-2">
              <InputField name="startsAt" label="Show from" type="date" optional defaultValue={initial.startsAt ?? ""} hint="Leave empty to show now." />
              <InputField name="endsAt" label="Hide after" type="date" optional defaultValue={initial.endsAt ?? ""} error={state.fieldErrors?.endsAt} />
            </div>
          </div>
          <div className="space-y-5">
            <SingleImageField name="imageId" label="Banner image" purpose="content" initialId={initial.imageId} initialUrl={initial.imageUrl} />
            <CheckboxField name="isPublished" label="Published" hint="Visible in the store (within the dates above)." defaultChecked={initial.isPublished ?? false} />
            <CheckboxField name="isFeatured" label="Feature on the homepage" defaultChecked={initial.isFeatured ?? false} />
            <InputField name="seoTitle" label="Search page title" optional maxLength={70} defaultValue={initial.seoTitle ?? ""} />
            <TextareaField name="seoDescription" label="Search description" optional rows={2} maxLength={170} defaultValue={initial.seoDescription ?? ""} />
          </div>
        </div>
      )}
    </AdminForm>
  );
}

export function TagGroupDialog({ initial, trigger, variant = "primary" }: { initial: { id?: string; name?: string; slug?: string; description?: string | null; isFilterable?: boolean }; trigger: string; variant?: ButtonVariant }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={buttonClass(variant, "sm")}>{trigger}</DialogTrigger>
      <DialogContent title={initial.id ? `Edit ${initial.name}` : "New filter group"} description="For example Occasion, Recipient, Color or Scent family.">
        <AdminForm action={closeOnSuccess(saveTagGroupAction, () => setOpen(false))}>
          {(state) => (
            <>
              {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
              <InputField name="name" label="Name" required maxLength={60} defaultValue={state.values?.name ?? initial.name} error={state.fieldErrors?.name} />
              <InputField name="slug" label="Name in web addresses" optional hint="Used in filter links, e.g. /shop?occasion=wedding" defaultValue={state.values?.slug ?? initial.slug} error={state.fieldErrors?.slug} />
              <TextareaField name="description" label="Description" optional rows={2} defaultValue={initial.description ?? ""} />
              <CheckboxField name="isFilterable" label="Show as a filter in the shop" defaultChecked={initial.isFilterable ?? true} />
            </>
          )}
        </AdminForm>
      </DialogContent>
    </Dialog>
  );
}

export function TagForm({ groupId, tag }: { groupId: string; tag?: { id: string; name: string } }) {
  return (
    <AdminForm action={saveTagAction} submitLabel={tag ? "Rename" : "Add"} className="flex flex-wrap items-end gap-2 space-y-0 [&>div:last-child]:pt-0" resetOnSuccess={!tag}>
      {(state) => (
        <>
          <input type="hidden" name="groupId" value={groupId} />
          {tag ? <input type="hidden" name="id" value={tag.id} /> : null}
          <InputField name="name" label={tag ? "Tag name" : "New tag"} required maxLength={60} defaultValue={tag?.name} error={state.fieldErrors?.name} containerClassName="min-w-48 flex-1" />
        </>
      )}
    </AdminForm>
  );
}
