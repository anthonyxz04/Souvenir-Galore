"use server";

import { prisma } from "@/lib/db";
import { absoluteUrl, env } from "@/lib/env";
import { generateToken, hashIp, readableCode, sha256 } from "@/lib/auth/crypto";
import { getCurrentUser } from "@/lib/auth/session";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { adminNotificationEmail, customRequestReceivedEmail, newsletterConfirmEmail } from "@/lib/email/templates";
import { checkLimit, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { getRequestMeta } from "@/lib/request";
import { getAllSettings } from "@/lib/settings";
import { checkSpam, spamMessage } from "@/lib/spam";
import { storeImage, ImageValidationError } from "@/lib/storage/images";
import {
  contactSchema,
  customRequestSchema,
  errorState,
  newsletterSchema,
  productInquirySchema,
  zodFieldErrors,
  type FormState,
} from "@/lib/validation/forms";

async function guard(formData: FormData, scope: "publicForm" | "newsletter"): Promise<FormState | null> {
  const { ip } = await getRequestMeta();
  const spam = await checkSpam(formData, ip);
  if (!spam.ok) return errorState(spamMessage(spam), undefined, formData);
  if (!(await checkLimit(scope, hashIp(ip)))) return errorState(RATE_LIMIT_MESSAGE, undefined, formData);
  return null;
}

async function notifyAdmins(heading: string, rows: { label: string; value: string }[], adminPath: string) {
  const recipients = env.adminNotificationEmails;
  if (recipients.length === 0) return;
  const { store } = await getAllSettings();
  const message = adminNotificationEmail(store.name, heading, rows, absoluteUrl(adminPath));
  await sendEmail({ to: recipients, ...message });
}

// ─────────────────────────────────────────────────────────────
// Newsletter (double opt-in when email is configured)
// ─────────────────────────────────────────────────────────────

export async function subscribeNewsletterAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const blocked = await guard(formData, "newsletter");
  if (blocked) return blocked;
  const parsed = newsletterSchema.safeParse({ email: formData.get("email"), consent: formData.get("consent") });
  if (!parsed.success) return errorState("Check the highlighted fields.", zodFieldErrors(parsed.error), formData);

  const { newsletter, store } = await getAllSettings();
  if (!newsletter.enabled) return errorState("The newsletter isn't accepting signups right now.");

  const email = parsed.data.email;
  const source = String(formData.get("source") ?? "website").slice(0, 40);
  const existing = await prisma.newsletterSubscriber.findUnique({ where: { email } });
  const doubleOptIn = newsletter.doubleOptIn && isEmailConfigured();

  if (existing?.status === "SUBSCRIBED") {
    return { status: "success", message: "You're subscribed. Thank you!" };
  }

  const confirmToken = doubleOptIn ? generateToken() : null;
  await prisma.newsletterSubscriber.upsert({
    where: { email },
    create: {
      email,
      status: doubleOptIn ? "PENDING" : "SUBSCRIBED",
      source,
      consentText: newsletter.consentText,
      consentedAt: new Date(),
      confirmTokenHash: confirmToken ? sha256(confirmToken) : null,
      unsubscribeToken: generateToken(24),
      confirmedAt: doubleOptIn ? null : new Date(),
    },
    update: {
      status: doubleOptIn ? "PENDING" : "SUBSCRIBED",
      consentText: newsletter.consentText,
      consentedAt: new Date(),
      confirmTokenHash: confirmToken ? sha256(confirmToken) : null,
      confirmedAt: doubleOptIn ? null : new Date(),
      unsubscribedAt: null,
    },
  });

  if (confirmToken) {
    await sendEmail({ to: email, ...newsletterConfirmEmail(store.name, confirmToken) });
    return { status: "success", message: "Almost done — check your inbox and confirm your subscription." };
  }
  return { status: "success", message: "You're subscribed. Thank you!" };
}

// ─────────────────────────────────────────────────────────────
// Contact form
// ─────────────────────────────────────────────────────────────

export async function sendContactMessageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const blocked = await guard(formData, "publicForm");
  if (blocked) return blocked;
  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return errorState("Check the highlighted fields.", zodFieldErrors(parsed.error), formData);

  const inquiry = await prisma.inquiry.create({
    data: {
      type: "CONTACT",
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      subject: parsed.data.subject,
      message: parsed.data.message,
    },
  });
  await notifyAdmins(
    "New contact message",
    [
      { label: "From", value: `${parsed.data.name} <${parsed.data.email}>` },
      { label: "Subject", value: parsed.data.subject ?? "—" },
      { label: "Message", value: parsed.data.message.slice(0, 500) },
    ],
    `/admin/inquiries?open=${inquiry.id}`,
  );
  return { status: "success", message: "Thank you — your message was sent. We usually reply within one or two working days." };
}

// ─────────────────────────────────────────────────────────────
// Product inquiry ("Ask about this product") — never an order
// ─────────────────────────────────────────────────────────────

export async function sendProductInquiryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const blocked = await guard(formData, "publicForm");
  if (blocked) return blocked;
  const parsed = productInquirySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return errorState("Check the highlighted fields.", zodFieldErrors(parsed.error), formData);

  const product = await prisma.product.findFirst({ where: { id: parsed.data.productId, status: "ACTIVE" }, select: { id: true, name: true } });
  if (!product) return errorState("This product is no longer available.");

  const inquiry = await prisma.inquiry.create({
    data: {
      type: "PRODUCT",
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      subject: `Question about ${product.name}`,
      message: parsed.data.message,
      productId: product.id,
      productName: product.name,
      variantTitle: parsed.data.variantTitle,
      quantity: parsed.data.quantity ?? null,
      personalization: parsed.data.personalization ? { text: parsed.data.personalization } : undefined,
    },
  });
  await notifyAdmins(
    `Product question: ${product.name}`,
    [
      { label: "From", value: `${parsed.data.name} <${parsed.data.email}>` },
      { label: "Option", value: parsed.data.variantTitle ?? "—" },
      { label: "Quantity", value: String(parsed.data.quantity ?? "—") },
      { label: "Message", value: parsed.data.message.slice(0, 500) },
    ],
    `/admin/inquiries?open=${inquiry.id}`,
  );
  return {
    status: "success",
    message: "Your question was sent. This isn't an order yet — we'll reply by email to confirm availability and details.",
  };
}

// ─────────────────────────────────────────────────────────────
// Custom order request (with optional reference images)
// ─────────────────────────────────────────────────────────────

const MAX_REFERENCE_IMAGES = 3;

export async function submitCustomRequestAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const settings = await getAllSettings();
  if (!settings.commerce.customOrdersEnabled) return errorState("Custom orders are paused right now. Please contact us instead.");
  const blocked = await guard(formData, "publicForm");
  if (blocked) return blocked;

  const raw = Object.fromEntries([...formData.entries()].filter(([, value]) => typeof value === "string"));
  const parsed = customRequestSchema.safeParse({ ...raw, quantity: raw.quantity || undefined, contactPreference: raw.contactPreference || undefined });
  if (!parsed.success) return errorState("Check the highlighted fields.", zodFieldErrors(parsed.error), formData);

  const files = formData.getAll("references").filter((value): value is File => value instanceof File && value.size > 0);
  if (files.length > 0 && !settings.commerce.customOrderUploadsEnabled) return errorState("Image uploads are turned off. Describe your idea in the details box instead.");
  if (files.length > MAX_REFERENCE_IMAGES) return errorState(`Attach up to ${MAX_REFERENCE_IMAGES} images.`, { references: `Attach up to ${MAX_REFERENCE_IMAGES} images.` }, formData);
  for (const file of files) {
    if (file.size > env.uploadMaxBytes) {
      return errorState(`Each image must be under ${Math.round(env.uploadMaxBytes / 1024 / 1024)} MB.`, { references: "One of the images is too large." }, formData);
    }
  }

  const user = await getCurrentUser();
  const assetIds: string[] = [];
  try {
    for (const file of files) {
      const asset = await storeImage({
        buffer: Buffer.from(await file.arrayBuffer()),
        originalName: file.name,
        prefix: "requests",
        visibility: "PRIVATE",
        uploadedById: user?.id ?? null,
      });
      assetIds.push(asset.id);
    }
  } catch (error) {
    if (error instanceof ImageValidationError) return errorState(error.message, { references: error.message }, formData);
    throw error;
  }

  let product: { id: string; name: string } | null = null;
  if (parsed.data.productId) {
    product = await prisma.product.findFirst({ where: { id: parsed.data.productId, status: "ACTIVE" }, select: { id: true, name: true } });
  }

  let number = `CR-${readableCode(6)}`;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const exists = await prisma.customRequest.findUnique({ where: { number }, select: { id: true } });
    if (!exists) break;
    number = `CR-${readableCode(6)}`;
  }

  const request = await prisma.customRequest.create({
    data: {
      number,
      userId: user?.id ?? null,
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      contactPreference: parsed.data.contactPreference ?? null,
      productType: parsed.data.productType,
      productId: product?.id ?? null,
      occasion: parsed.data.occasion,
      quantity: parsed.data.quantity ?? null,
      preferences: parsed.data.preferences,
      personalizationText: parsed.data.personalizationText,
      desiredDate: parsed.data.desiredDate,
      budgetRange: parsed.data.budgetRange,
      details: parsed.data.details,
      attachments: { create: assetIds.map((assetId) => ({ assetId })) },
    },
  });

  await sendEmail({ to: parsed.data.email, ...customRequestReceivedEmail(settings.store.name, { number, name: parsed.data.name }) });
  await notifyAdmins(
    `New custom request ${number}`,
    [
      { label: "From", value: `${parsed.data.name} <${parsed.data.email}>` },
      { label: "What", value: parsed.data.productType },
      { label: "Occasion", value: parsed.data.occasion ?? "—" },
      { label: "Quantity", value: String(parsed.data.quantity ?? "—") },
      { label: "Needed by", value: parsed.data.desiredDate ? parsed.data.desiredDate.toISOString().slice(0, 10) : "—" },
    ],
    `/admin/custom-requests/${request.id}`,
  );

  return {
    status: "success",
    message: `Thank you — your request ${number} was sent. This isn't an order yet: we'll reply with questions or a quote before anything is made or charged.`,
    data: { number },
  };
}
