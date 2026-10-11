"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { syncProductRating } from "@/lib/catalog/sync";
import { normalizeDiscountCode } from "@/lib/discounts/evaluate";
import { CUSTOM_REQUEST_STATUSES } from "@/lib/domain";
import { sendEmail } from "@/lib/email";
import { customRequestQuotedEmail } from "@/lib/email/templates";
import { absoluteUrl } from "@/lib/env";
import { formatMoney, parseMoney } from "@/lib/money";
import { getAllSettings } from "@/lib/settings";
import { checkbox, errorState, zodFieldErrors, type FormState } from "@/lib/validation/forms";
import { actorOf, guarded, requirePermission } from "@/server/guard";

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

// ─────────────────────────────────────────────────────────────
// Custom requests
// ─────────────────────────────────────────────────────────────

export async function updateCustomRequestAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return guarded("requests:manage", async (user) => {
    const parsed = z
      .object({
        id: z.string().min(1).max(40),
        status: z.enum(CUSTOM_REQUEST_STATUSES),
        quotedAmount: text(20),
        quoteNote: text(2000),
        adminNotes: text(4000),
        sendQuote: checkbox,
      })
      .safeParse(Object.fromEntries(formData));
    if (!parsed.success) return errorState("Check the highlighted fields.", zodFieldErrors(parsed.error), formData);
    const data = parsed.data;
    const settings = await getAllSettings();
    const decimals = settings.commerce.currencyDecimals;
    const quotedAmount = data.quotedAmount ? parseMoney(data.quotedAmount, decimals) : null;
    if (data.quotedAmount && quotedAmount === null) return errorState("Enter the quote like 120.00.", { quotedAmount: "Enter an amount like 120.00." }, formData);
    if (data.sendQuote && quotedAmount === null) return errorState("Add a quote amount before sending it.", { quotedAmount: "Required to send a quote." }, formData);

    const request = await prisma.customRequest.update({
      where: { id: data.id },
      data: {
        status: data.sendQuote && data.status === "NEW" ? "QUOTED" : data.sendQuote && data.status === "IN_REVIEW" ? "QUOTED" : data.status,
        quotedAmount,
        quoteNote: data.quoteNote,
        adminNotes: data.adminNotes,
      },
    });
    if (data.sendQuote && quotedAmount !== null) {
      const currency = { code: settings.commerce.currencyCode, decimals, locale: settings.commerce.currencyLocale };
      await sendEmail({
        to: request.email,
        ...customRequestQuotedEmail(settings.store.name, {
          number: request.number,
          name: request.name,
          amount: formatMoney(quotedAmount, currency),
          note: data.quoteNote ?? undefined,
          url: absoluteUrl("/account/custom-requests"),
        }),
        replyTo: settings.contact.email || undefined,
      });
    }
    await logAudit({ actor: actorOf(user), action: "request.update", entityType: "CustomRequest", entityId: request.id, summary: `${request.number}: ${request.status}${data.sendQuote ? " (quote sent)" : ""}` });
    revalidatePath(`/admin/custom-requests/${request.id}`);
    revalidatePath("/admin/custom-requests");
    return { status: "success", message: data.sendQuote ? "Saved and the quote was emailed to the customer." : "Saved." };
  });
}

// ─────────────────────────────────────────────────────────────
// Inquiries (contact form, product questions)
// ─────────────────────────────────────────────────────────────

export async function updateInquiryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return guarded("requests:manage", async (user) => {
    const parsed = z
      .object({ id: z.string().min(1).max(40), status: z.enum(["NEW", "IN_PROGRESS", "RESOLVED", "SPAM"]), adminNotes: text(4000) })
      .safeParse(Object.fromEntries(formData));
    if (!parsed.success) return errorState("Check the highlighted fields.", zodFieldErrors(parsed.error));
    await prisma.inquiry.update({ where: { id: parsed.data.id }, data: { status: parsed.data.status, adminNotes: parsed.data.adminNotes } });
    await logAudit({ actor: actorOf(user), action: "inquiry.update", entityType: "Inquiry", entityId: parsed.data.id, summary: parsed.data.status });
    revalidatePath("/admin/inquiries");
    return { status: "success", message: "Saved." };
  });
}

// ─────────────────────────────────────────────────────────────
// Reviews
// ─────────────────────────────────────────────────────────────

export async function moderateReviewAction(formData: FormData): Promise<void> {
  const user = await requirePermission("reviews:manage");
  const id = String(formData.get("id") ?? "");
  const action = String(formData.get("action") ?? "");
  const review = await prisma.review.findUnique({ where: { id }, select: { productId: true } });
  if (!review) return;
  switch (action) {
    case "approve":
      await prisma.review.update({ where: { id }, data: { status: "APPROVED" } });
      break;
    case "reject":
      await prisma.review.update({ where: { id }, data: { status: "REJECTED", isFeatured: false } });
      break;
    case "feature":
      await prisma.review.update({ where: { id }, data: { isFeatured: true, status: "APPROVED" } });
      break;
    case "unfeature":
      await prisma.review.update({ where: { id }, data: { isFeatured: false } });
      break;
    case "delete":
      await prisma.review.delete({ where: { id } });
      break;
    default:
      return;
  }
  await syncProductRating(review.productId);
  await logAudit({ actor: actorOf(user), action: `review.${action}`, entityType: "Review", entityId: id });
  revalidatePath("/admin/reviews");
  revalidatePath("/", "layout");
}

// ─────────────────────────────────────────────────────────────
// Discounts
// ─────────────────────────────────────────────────────────────

const discountSchema = z.object({
  id: text(40),
  code: z.string().trim().min(3, "Use at least 3 characters.").max(40).regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, - and _ only."),
  description: text(200),
  type: z.enum(["PERCENTAGE", "FIXED_AMOUNT", "FREE_DELIVERY"]),
  value: text(20),
  maxDiscountAmount: text(20),
  minSubtotal: text(20),
  startsAt: text(40),
  endsAt: text(40),
  usageLimit: text(10),
  perCustomerLimit: text(10),
  isActive: checkbox,
});

export async function saveDiscountAction(_prev: FormState, formData: FormData): Promise<FormState> {
  let saved = false;
  const result = await guarded("discounts:manage", async (user) => {
    const parsed = discountSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return errorState("Check the highlighted fields.", zodFieldErrors(parsed.error), formData);
    const data = parsed.data;
    const decimals = (await getAllSettings()).commerce.currencyDecimals;
    const errors: Record<string, string> = {};
    let value = 0;
    if (data.type === "PERCENTAGE") {
      value = Number(data.value);
      if (!Number.isInteger(value) || value < 1 || value > 100) errors.value = "Enter a whole percentage from 1 to 100.";
    } else if (data.type === "FIXED_AMOUNT") {
      value = parseMoney(data.value, decimals) ?? -1;
      if (value <= 0) errors.value = "Enter the amount off, like 5.00.";
    }
    const money = (field: "maxDiscountAmount" | "minSubtotal") => {
      if (!data[field]) return null;
      const parsedValue = parseMoney(data[field], decimals);
      if (parsedValue === null) errors[field] = "Enter an amount like 50.00.";
      return parsedValue;
    };
    const count = (field: "usageLimit" | "perCustomerLimit") => {
      if (!data[field]) return null;
      const n = Number(data[field]);
      if (!Number.isInteger(n) || n < 1) errors[field] = "Enter a whole number, or leave empty for no limit.";
      return n;
    };
    const maxDiscountAmount = money("maxDiscountAmount");
    const minSubtotal = money("minSubtotal");
    const usageLimit = count("usageLimit");
    const perCustomerLimit = count("perCustomerLimit");
    const startsAt = data.startsAt ? new Date(data.startsAt) : null;
    const endsAt = data.endsAt ? new Date(data.endsAt) : null;
    if (startsAt && Number.isNaN(startsAt.getTime())) errors.startsAt = "Enter a valid date.";
    if (endsAt && Number.isNaN(endsAt.getTime())) errors.endsAt = "Enter a valid date.";
    if (startsAt && endsAt && endsAt <= startsAt) errors.endsAt = "Must be after the start.";
    if (Object.keys(errors).length) return errorState("Check the highlighted fields.", errors, formData);

    const code = normalizeDiscountCode(data.code);
    const clash = await prisma.discount.findUnique({ where: { code }, select: { id: true } });
    if (clash && clash.id !== data.id) return errorState("This code already exists.", { code: "Already exists." }, formData);
    const values = {
      code,
      description: data.description,
      type: data.type,
      value,
      maxDiscountAmount: data.type === "PERCENTAGE" ? maxDiscountAmount : null,
      minSubtotal,
      startsAt,
      endsAt,
      usageLimit,
      perCustomerLimit,
      isActive: data.isActive,
    };
    if (data.id) await prisma.discount.update({ where: { id: data.id }, data: values });
    else await prisma.discount.create({ data: values });
    await logAudit({ actor: actorOf(user), action: data.id ? "discount.update" : "discount.create", entityType: "Discount", entityId: data.id ?? undefined, summary: code });
    revalidatePath("/admin/discounts");
    saved = true;
    return { status: "success", message: "Discount saved." };
  });
  if (saved) redirect("/admin/discounts");
  return result;
}

export async function toggleDiscountAction(formData: FormData): Promise<void> {
  const user = await requirePermission("discounts:manage");
  const id = String(formData.get("id") ?? "");
  const discount = await prisma.discount.findUnique({ where: { id }, select: { isActive: true, code: true } });
  if (!discount) return;
  await prisma.discount.update({ where: { id }, data: { isActive: !discount.isActive } });
  await logAudit({ actor: actorOf(user), action: "discount.toggle", entityType: "Discount", entityId: id, summary: `${discount.code}: ${discount.isActive ? "paused" : "activated"}` });
  revalidatePath("/admin/discounts");
}

export async function deleteDiscountAction(formData: FormData): Promise<void> {
  const user = await requirePermission("discounts:manage");
  const id = String(formData.get("id") ?? "");
  const discount = await prisma.discount.findUnique({ where: { id }, select: { code: true, _count: { select: { orders: true } } } });
  if (!discount) redirect("/admin/discounts");
  if (discount._count.orders > 0) {
    await prisma.discount.update({ where: { id }, data: { isActive: false } });
  } else {
    await prisma.discount.delete({ where: { id } });
  }
  await logAudit({ actor: actorOf(user), action: "discount.delete", entityType: "Discount", entityId: id, summary: discount.code });
  revalidatePath("/admin/discounts");
  redirect("/admin/discounts");
}
