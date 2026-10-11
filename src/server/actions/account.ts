"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { hashIp } from "@/lib/auth/crypto";
import { AccountError, changePassword, deleteCustomerAccount } from "@/lib/auth/service";
import { destroyCurrentSession, destroyUserSessions, getCurrentSession, getCurrentUser } from "@/lib/auth/session";
import { syncProductRating } from "@/lib/catalog/sync";
import { sendEmail } from "@/lib/email";
import { passwordChangedEmail } from "@/lib/email/templates";
import { checkLimit, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { getRequestMeta } from "@/lib/request";
import { getSettings } from "@/lib/settings";
import { safeRedirectPath } from "@/lib/text";
import { verifyPassword } from "@/lib/auth/password";
import {
  addressSchema,
  changePasswordSchema,
  errorState,
  profileSchema,
  reviewSchema,
  zodFieldErrors,
  type FormState,
} from "@/lib/validation/forms";

async function requireSession() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  return session;
}

// ── Wishlist ──────────────────────────────────────────────────

export async function toggleWishlistAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  const returnTo = safeRedirectPath(String(formData.get("returnTo") ?? ""), "/account/wishlist");
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  const productId = String(formData.get("productId") ?? "");
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) return;
  const key = { userId_productId: { userId: user.id, productId } };
  const existing = await prisma.wishlistItem.findUnique({ where: key });
  if (existing) await prisma.wishlistItem.delete({ where: key });
  else await prisma.wishlistItem.create({ data: { userId: user.id, productId } });
  revalidatePath(returnTo);
  revalidatePath("/account/wishlist");
}

// ── Reviews ───────────────────────────────────────────────────

export async function submitReviewAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return errorState("Please sign in to write a review.");
  if (!user.emailVerifiedAt) return errorState("Please confirm your email address before writing a review.");
  const parsed = reviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return errorState("Check the highlighted fields.", zodFieldErrors(parsed.error), formData);
  if (!(await checkLimit("review", user.id))) return errorState(RATE_LIMIT_MESSAGE);

  const product = await prisma.product.findFirst({ where: { id: parsed.data.productId, status: "ACTIVE" }, select: { id: true } });
  if (!product) return errorState("This product is no longer available.");
  const existing = await prisma.review.findUnique({ where: { productId_userId: { productId: product.id, userId: user.id } } });
  if (existing) return errorState("You've already reviewed this piece.");

  const purchased = await prisma.orderItem.count({
    where: { productId: product.id, order: { userId: user.id, status: { not: "CANCELLED" } } },
  });
  await prisma.review.create({
    data: {
      productId: product.id,
      userId: user.id,
      authorName: user.name.split(/\s+/)[0]?.slice(0, 40) || "Customer",
      rating: parsed.data.rating,
      title: parsed.data.title,
      body: parsed.data.body,
      verifiedPurchase: purchased > 0,
      status: "PENDING",
    },
  });
  await syncProductRating(product.id);
  return { status: "success", message: "Thank you! Your review will appear once we've checked it." };
}

// ── Profile ───────────────────────────────────────────────────

export async function updateProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireSession();
  const parsed = profileSchema.safeParse({ name: formData.get("name"), phone: formData.get("phone") ?? "", marketingOptIn: formData.get("marketingOptIn") });
  if (!parsed.success) return errorState("Check the highlighted fields.", zodFieldErrors(parsed.error), formData);
  await prisma.user.update({ where: { id: user.id }, data: parsed.data });
  revalidatePath("/account", "layout");
  return { status: "success", message: "Your details were saved." };
}

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return errorState("Check the highlighted fields.", zodFieldErrors(parsed.error));
  if (!(await checkLimit("loginPerAccount", session.user.email))) return errorState(RATE_LIMIT_MESSAGE);
  try {
    const user = await changePassword(session.user.id, parsed.data.currentPassword, parsed.data.newPassword, session.sessionId);
    const store = await getSettings("store");
    await sendEmail({ to: user.email, ...passwordChangedEmail(store.name, user.name) });
    const { ip } = await getRequestMeta();
    await logAudit({ actor: { id: user.id, email: user.email }, action: "auth.password_change", entityType: "User", entityId: user.id, ipHash: hashIp(ip) });
  } catch (error) {
    if (error instanceof AccountError) {
      const field = error.message.includes("current") ? "currentPassword" : "newPassword";
      return errorState(error.message, { [field]: error.message });
    }
    throw error;
  }
  return { status: "success", message: "Password changed. Other devices have been signed out." };
}

export async function signOutOtherSessionsAction(): Promise<void> {
  const session = await requireSession();
  await destroyUserSessions(session.user.id, session.sessionId);
  revalidatePath("/account/security");
}

export async function deleteAccountAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (confirm.trim().toUpperCase() !== "DELETE") return errorState("Type DELETE to confirm.", { confirm: "Type DELETE to confirm." });
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.passwordHash || !(await verifyPassword(user.passwordHash, password))) {
    return errorState("Your password is incorrect.", { password: "Your password is incorrect." });
  }
  try {
    await deleteCustomerAccount(user.id);
  } catch (error) {
    if (error instanceof AccountError) return errorState(error.message);
    throw error;
  }
  await logAudit({ actor: null, action: "account.deleted", entityType: "User", entityId: user.id, summary: "Customer deleted their account" });
  await destroyCurrentSession();
  redirect("/?account-deleted=1");
}

// ── Addresses ─────────────────────────────────────────────────

export async function saveAddressAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireSession();
  const parsed = addressSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return errorState("Check the highlighted fields.", zodFieldErrors(parsed.error), formData);
  const addressId = String(formData.get("addressId") ?? "");
  const { isDefault, zoneId, ...data } = parsed.data;
  const zone = zoneId ? await prisma.deliveryZone.findFirst({ where: { id: zoneId }, select: { id: true } }) : null;

  try {
    await prisma.$transaction(async (tx) => {
      const count = await tx.address.count({ where: { userId: user.id } });
      if (count >= 20 && !addressId) throw new AccountError("You can save up to 20 addresses.");
      const makeDefault = isDefault || count === 0;
      if (makeDefault) await tx.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
      if (addressId) {
        const owned = await tx.address.findFirst({ where: { id: addressId, userId: user.id }, select: { id: true } });
        if (!owned) throw new AccountError("Address not found.");
        await tx.address.update({ where: { id: addressId }, data: { ...data, deliveryZoneId: zone?.id ?? null, ...(makeDefault ? { isDefault: true } : {}) } });
      } else {
        await tx.address.create({ data: { ...data, userId: user.id, deliveryZoneId: zone?.id ?? null, isDefault: makeDefault } });
      }
    });
  } catch (error) {
    if (error instanceof AccountError) return errorState(error.message, undefined, formData);
    throw error;
  }
  revalidatePath("/account/addresses");
  return { status: "success", message: "Address saved." };
}

export async function deleteAddressAction(formData: FormData): Promise<void> {
  const { user } = await requireSession();
  const addressId = String(formData.get("addressId") ?? "");
  await prisma.address.deleteMany({ where: { id: addressId, userId: user.id } });
  revalidatePath("/account/addresses");
}

export async function setDefaultAddressAction(formData: FormData): Promise<void> {
  const { user } = await requireSession();
  const addressId = String(formData.get("addressId") ?? "");
  const owned = await prisma.address.findFirst({ where: { id: addressId, userId: user.id }, select: { id: true } });
  if (!owned) return;
  await prisma.$transaction([
    prisma.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } }),
    prisma.address.update({ where: { id: addressId }, data: { isDefault: true } }),
  ]);
  revalidatePath("/account/addresses");
}
