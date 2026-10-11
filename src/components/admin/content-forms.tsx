"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { saveFaqAction, savePageAction } from "@/server/actions/admin/content";
import { cn } from "@/lib/utils";
import { CheckboxField, InputField, SelectField, TextareaField, controlClass } from "@/components/ui/field";
import { AdminForm } from "./admin-form";

type PageInitial = {
  id?: string;
  title: string;
  slug: string;
  body: string;
  footerGroup: string;
  position: number;
  seoTitle: string;
  seoDescription: string;
  isPublished: boolean;
  showInFooter: boolean;
  needsOwnerReview: boolean;
};

export function PageForm({ initial }: { initial: PageInitial }) {
  const [body, setBody] = useState(initial.body);
  const [preview, setPreview] = useState(false);
  return (
    <AdminForm action={savePageAction} submitLabel={initial.id ? "Save page" : "Create page"}>
      {(state) => (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
          <div className="space-y-5">
            <InputField name="title" label="Title" required maxLength={120} defaultValue={state.values?.title ?? initial.title} error={state.fieldErrors?.title} />
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="page-body" className="text-sm font-medium">
                  Content
                </label>
                <div className="flex rounded-full bg-white p-0.5 text-sm ring-1 ring-line">
                  <button type="button" onClick={() => setPreview(false)} className={cn("rounded-full px-3 py-1", !preview && "bg-ink text-white")} aria-pressed={!preview}>
                    Write
                  </button>
                  <button type="button" onClick={() => setPreview(true)} className={cn("rounded-full px-3 py-1", preview && "bg-ink text-white")} aria-pressed={preview}>
                    Preview
                  </button>
                </div>
              </div>
              <textarea id="page-body" name="body" rows={22} value={body} onChange={(e) => setBody(e.target.value)} className={cn(controlClass, "font-mono text-sm", preview && "hidden")} />
              {preview ? (
                <div className="prose-sg min-h-64 rounded-xl bg-white p-5 ring-1 ring-line">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>
                    {body}
                  </ReactMarkdown>
                </div>
              ) : null}
              <p className="text-[0.8125rem] text-ink-soft">
                Formatting: <code>## Heading</code>, <code>**bold**</code>, <code>- list</code>, <code>[link](https://…)</code>.
              </p>
            </div>
          </div>
          <div className="space-y-5">
            <InputField name="slug" label="Web address" optional hint="/pages/web-address" defaultValue={state.values?.slug ?? initial.slug} error={state.fieldErrors?.slug} />
            <CheckboxField name="isPublished" label="Published" defaultChecked={initial.isPublished} />
            <CheckboxField name="showInFooter" label="Link in the footer" defaultChecked={initial.showInFooter} />
            <SelectField name="footerGroup" label="Footer column" defaultValue={initial.footerGroup} options={[{ value: "help", label: "Help" }, { value: "policies", label: "Policies (bottom row)" }]} />
            <InputField name="position" label="Order in footer" type="number" min={0} defaultValue={String(initial.position)} />
            <CheckboxField name="needsOwnerReview" label="Needs owner review" hint="Shown as a reminder in the pages list. Untick once you've checked the wording." defaultChecked={initial.needsOwnerReview} />
            <InputField name="seoTitle" label="Search page title" optional maxLength={70} defaultValue={initial.seoTitle} />
            <TextareaField name="seoDescription" label="Search description" optional rows={2} maxLength={170} defaultValue={initial.seoDescription} />
          </div>
        </div>
      )}
    </AdminForm>
  );
}

export function FaqForm({ item }: { item?: { id: string; question: string; answer: string; category: string; isPublished: boolean } }) {
  return (
    <AdminForm action={saveFaqAction} submitLabel={item ? "Save" : "Add question"} resetOnSuccess={!item}>
      {(state) => (
        <>
          {item ? <input type="hidden" name="id" value={item.id} /> : null}
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_14rem]">
            <InputField name="question" label="Question" required maxLength={300} defaultValue={item?.question} error={state.fieldErrors?.question} />
            <InputField name="category" label="Group" optional maxLength={60} defaultValue={item?.category} placeholder="Ordering, Delivery…" />
          </div>
          <TextareaField name="answer" label="Answer" required rows={3} maxLength={5000} defaultValue={item?.answer} error={state.fieldErrors?.answer} />
          <CheckboxField name="isPublished" label="Published" defaultChecked={item?.isPublished ?? true} />
        </>
      )}
    </AdminForm>
  );
}
