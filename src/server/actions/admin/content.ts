"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { HomeSectionType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { categoryGridConfigSchema, featuredCollectionsConfigSchema, productGridConfigSchema, SECTION_TYPE_INFO } from "@/lib/content/home";
import { isValidSlug, safeHref, slugify } from "@/lib/text";
import { checkbox, errorState, zodFieldErrors, type FormState } from "@/lib/validation/forms";
import { actorOf, AdminActionError, guarded, requirePermission } from "@/server/guard";

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

// ─────────────────────────────────────────────────────────────
// Homepage sections
// ─────────────────────────────────────────────────────────────

const sectionPayloadSchema = z.object({
  id: z.string().max(40),
  title: text(160),
  subtitle: text(400),
  body: text(3000),
  ctaLabel: text(60),
  ctaHref: text(300),
  secondaryCtaLabel: text(60),
  secondaryCtaHref: text(300),
  imageId: text(40),
  isVisible: z.boolean(),
  startsAt: text(40),
  endsAt: text(40),
  config: z.record(z.unknown()).default({}),
  items: z
    .array(z.object({ title: text(120), body: text(600), href: text(300), imageId: text(40) }))
    .max(12)
    .default([]),
});

export async function saveHomeSectionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return guarded("content:manage", async (user) => {
    let raw: unknown;
    try {
      raw = JSON.parse(String(formData.get("payload") ?? ""));
    } catch {
      throw new AdminActionError("The form couldn't be read. Reload and try again.");
    }
    const parsed = sectionPayloadSchema.safeParse(raw);
    if (!parsed.success) return errorState("Check the highlighted fields.", zodFieldErrors(parsed.error));
    const data = parsed.data;
    const section = await prisma.homeSection.findUnique({ where: { id: data.id }, select: { id: true, type: true } });
    if (!section) throw new AdminActionError("This section no longer exists.");

    for (const [field, value] of [
      ["ctaHref", data.ctaHref],
      ["secondaryCtaHref", data.secondaryCtaHref],
    ] as const) {
      if (value && !safeHref(value)) return errorState("Links must start with / (a page on this site) or https://.", { [field]: "Use /page or https://…" });
    }

    let config: Record<string, unknown> = {};
    if (section.type === "PRODUCT_GRID") config = productGridConfigSchema.parse(data.config);
    if (section.type === "CATEGORY_GRID") config = categoryGridConfigSchema.parse(data.config);
    if (section.type === "FEATURED_COLLECTIONS") config = featuredCollectionsConfigSchema.parse(data.config);

    const assetIds = [data.imageId, ...data.items.map((i) => i.imageId)].filter(Boolean) as string[];
    const assets = new Set((await prisma.mediaAsset.findMany({ where: { id: { in: assetIds }, visibility: "PUBLIC" }, select: { id: true } })).map((a) => a.id));
    const startsAt = data.startsAt ? new Date(data.startsAt) : null;
    const endsAt = data.endsAt ? new Date(data.endsAt) : null;

    await prisma.$transaction([
      prisma.homeSection.update({
        where: { id: section.id },
        data: {
          title: data.title,
          subtitle: data.subtitle,
          body: data.body,
          ctaLabel: data.ctaLabel,
          ctaHref: data.ctaHref,
          secondaryCtaLabel: data.secondaryCtaLabel,
          secondaryCtaHref: data.secondaryCtaHref,
          imageId: data.imageId && assets.has(data.imageId) ? data.imageId : null,
          isVisible: data.isVisible,
          startsAt: startsAt && !Number.isNaN(startsAt.getTime()) ? startsAt : null,
          endsAt: endsAt && !Number.isNaN(endsAt.getTime()) ? endsAt : null,
          config: config as object,
        },
      }),
      prisma.homeSectionItem.deleteMany({ where: { sectionId: section.id } }),
      prisma.homeSectionItem.createMany({
        data: data.items
          .filter((item) => item.title || item.body || item.imageId)
          .map((item, position) => ({
            sectionId: section.id,
            title: item.title,
            body: item.body,
            href: item.href && safeHref(item.href) ? item.href : null,
            imageId: item.imageId && assets.has(item.imageId) ? item.imageId : null,
            position,
          })),
      }),
    ]);
    await logAudit({ actor: actorOf(user), action: "homepage.section_update", entityType: "HomeSection", entityId: section.id, summary: SECTION_TYPE_INFO[section.type].label });
    revalidatePath("/");
    revalidatePath("/admin/homepage");
    return { status: "success", message: "Section saved. The homepage is updated." };
  });
}

export async function addHomeSectionAction(formData: FormData): Promise<void> {
  const user = await requirePermission("content:manage");
  const type = String(formData.get("type") ?? "") as HomeSectionType;
  if (!(type in SECTION_TYPE_INFO)) return;
  const last = await prisma.homeSection.aggregate({ _max: { position: true } });
  const section = await prisma.homeSection.create({
    data: { type, title: SECTION_TYPE_INFO[type].label, isVisible: false, position: (last._max.position ?? -1) + 1, config: {} },
  });
  await logAudit({ actor: actorOf(user), action: "homepage.section_add", entityType: "HomeSection", entityId: section.id, summary: type });
  redirect(`/admin/homepage/${section.id}`);
}

export async function moveHomeSectionAction(formData: FormData): Promise<void> {
  await requirePermission("content:manage");
  const id = String(formData.get("id") ?? "");
  const direction = formData.get("direction") === "up" ? -1 : 1;
  const sections = await prisma.homeSection.findMany({ orderBy: { position: "asc" }, select: { id: true } });
  const ids = sections.map((s) => s.id);
  const index = ids.indexOf(id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= ids.length) return;
  [ids[index], ids[target]] = [ids[target], ids[index]];
  for (const [position, sectionId] of ids.entries()) await prisma.homeSection.update({ where: { id: sectionId }, data: { position } });
  revalidatePath("/admin/homepage");
  revalidatePath("/");
}

export async function toggleHomeSectionAction(formData: FormData): Promise<void> {
  await requirePermission("content:manage");
  const id = String(formData.get("id") ?? "");
  const section = await prisma.homeSection.findUnique({ where: { id }, select: { isVisible: true } });
  if (!section) return;
  await prisma.homeSection.update({ where: { id }, data: { isVisible: !section.isVisible } });
  revalidatePath("/admin/homepage");
  revalidatePath("/");
}

export async function deleteHomeSectionAction(formData: FormData): Promise<void> {
  const user = await requirePermission("content:manage");
  const id = String(formData.get("id") ?? "");
  await prisma.homeSection.deleteMany({ where: { id } });
  await logAudit({ actor: actorOf(user), action: "homepage.section_delete", entityType: "HomeSection", entityId: id });
  revalidatePath("/");
  redirect("/admin/homepage");
}

// ─────────────────────────────────────────────────────────────
// Pages (About, policies…)
// ─────────────────────────────────────────────────────────────

const pageSchema = z.object({
  id: text(40),
  title: z.string().trim().min(1, "Enter a title.").max(120),
  slug: text(100),
  body: z.string().max(60_000),
  footerGroup: z.enum(["shop", "help", "policies"]).nullish().or(z.literal("")).transform((v) => v || null),
  position: z.coerce.number().int().min(0).max(1000).default(0),
  seoTitle: text(70),
  seoDescription: text(170),
  isPublished: checkbox,
  showInFooter: checkbox,
  needsOwnerReview: checkbox,
});

export async function savePageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  let createdId: string | null = null;
  const result = await guarded("content:manage", async (user) => {
    const parsed = pageSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return errorState("Check the highlighted fields.", zodFieldErrors(parsed.error), formData);
    const data = parsed.data;
    const slug = (data.slug ?? "").toLowerCase() || slugify(data.title);
    if (!isValidSlug(slug)) return errorState("Use lowercase letters, numbers and hyphens for the web address.", { slug: "Invalid web address." }, formData);
    const clash = await prisma.page.findUnique({ where: { slug }, select: { id: true } });
    if (clash && clash.id !== data.id) return errorState("Another page already uses this web address.", { slug: "Already in use." }, formData);
    const values = {
      title: data.title,
      slug,
      body: data.body,
      footerGroup: data.footerGroup,
      position: data.position,
      seoTitle: data.seoTitle,
      seoDescription: data.seoDescription,
      isPublished: data.isPublished,
      showInFooter: data.showInFooter,
      needsOwnerReview: data.needsOwnerReview,
    };
    if (data.id) await prisma.page.update({ where: { id: data.id }, data: values });
    else createdId = (await prisma.page.create({ data: values })).id;
    await logAudit({ actor: actorOf(user), action: data.id ? "page.update" : "page.create", entityType: "Page", entityId: data.id ?? createdId ?? undefined, summary: data.title });
    revalidatePath("/", "layout");
    revalidatePath("/admin/pages");
    return { status: "success", message: "Page saved." };
  });
  if (createdId) redirect(`/admin/pages/${createdId}`);
  return result;
}

export async function deletePageAction(formData: FormData): Promise<void> {
  const user = await requirePermission("content:manage");
  const id = String(formData.get("id") ?? "");
  const page = await prisma.page.findUnique({ where: { id }, select: { title: true } });
  if (page) {
    await prisma.page.delete({ where: { id } });
    await logAudit({ actor: actorOf(user), action: "page.delete", entityType: "Page", entityId: id, summary: page.title });
  }
  revalidatePath("/", "layout");
  redirect("/admin/pages");
}

// ─────────────────────────────────────────────────────────────
// FAQ
// ─────────────────────────────────────────────────────────────

export async function saveFaqAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return guarded("content:manage", async (user) => {
    const parsed = z
      .object({
        id: text(40),
        question: z.string().trim().min(3, "Enter the question.").max(300),
        answer: z.string().trim().min(1, "Enter the answer.").max(5000),
        category: text(60),
        isPublished: checkbox,
      })
      .safeParse(Object.fromEntries(formData));
    if (!parsed.success) return errorState("Check the highlighted fields.", zodFieldErrors(parsed.error), formData);
    const { id, ...values } = parsed.data;
    if (id) await prisma.faqItem.update({ where: { id }, data: values });
    else {
      const last = await prisma.faqItem.aggregate({ _max: { position: true } });
      await prisma.faqItem.create({ data: { ...values, position: (last._max.position ?? -1) + 1 } });
    }
    await logAudit({ actor: actorOf(user), action: "faq.save", entityType: "FaqItem", entityId: id ?? undefined, summary: values.question.slice(0, 120) });
    revalidatePath("/faq");
    revalidatePath("/admin/faq");
    return { status: "success", message: "Saved." };
  });
}

export async function deleteFaqAction(formData: FormData): Promise<void> {
  await requirePermission("content:manage");
  await prisma.faqItem.deleteMany({ where: { id: String(formData.get("id") ?? "") } });
  revalidatePath("/faq");
  revalidatePath("/admin/faq");
}

export async function moveFaqAction(formData: FormData): Promise<void> {
  await requirePermission("content:manage");
  const id = String(formData.get("id") ?? "");
  const direction = formData.get("direction") === "up" ? -1 : 1;
  const items = await prisma.faqItem.findMany({ orderBy: [{ category: "asc" }, { position: "asc" }], select: { id: true } });
  const ids = items.map((i) => i.id);
  const index = ids.indexOf(id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= ids.length) return;
  [ids[index], ids[target]] = [ids[target], ids[index]];
  for (const [position, faqId] of ids.entries()) await prisma.faqItem.update({ where: { id: faqId }, data: { position } });
  revalidatePath("/faq");
  revalidatePath("/admin/faq");
}

// ─────────────────────────────────────────────────────────────
// Newsletter
// ─────────────────────────────────────────────────────────────

export async function unsubscribeSubscriberAction(formData: FormData): Promise<void> {
  const user = await requirePermission("newsletter:manage");
  const id = String(formData.get("id") ?? "");
  await prisma.newsletterSubscriber.updateMany({ where: { id }, data: { status: "UNSUBSCRIBED", unsubscribedAt: new Date() } });
  await logAudit({ actor: actorOf(user), action: "newsletter.unsubscribe", entityType: "NewsletterSubscriber", entityId: id });
  revalidatePath("/admin/newsletter");
}

export async function deleteSubscriberAction(formData: FormData): Promise<void> {
  const user = await requirePermission("newsletter:manage");
  const id = String(formData.get("id") ?? "");
  await prisma.newsletterSubscriber.deleteMany({ where: { id } });
  await logAudit({ actor: actorOf(user), action: "newsletter.delete", entityType: "NewsletterSubscriber", entityId: id, summary: "Subscriber data erased" });
  revalidatePath("/admin/newsletter");
}
