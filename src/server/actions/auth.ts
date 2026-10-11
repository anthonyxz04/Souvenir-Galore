"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { hashIp } from "@/lib/auth/crypto";
import { isStaffRole } from "@/lib/auth/permissions";
import { AccountError, authenticate, createUser, issueAuthToken, resetPasswordWithToken } from "@/lib/auth/service";
import { createSession, destroyCurrentSession, getCurrentUser } from "@/lib/auth/session";
import { mergeGuestCart } from "@/lib/cart/service";
import { sendEmail } from "@/lib/email";
import { passwordChangedEmail, passwordResetEmail, verificationEmail } from "@/lib/email/templates";
import { checkLimit, clearLimit, isLimited, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { getRequestMeta } from "@/lib/request";
import { getSettings } from "@/lib/settings";
import { checkSpam, spamMessage } from "@/lib/spam";
import { safeRedirectPath } from "@/lib/text";
import { errorState, forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema, zodFieldErrors, type FormState } from "@/lib/validation/forms";

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return errorState("Enter your email and password.", zodFieldErrors(parsed.error), formData);

  const { ip, userAgent } = await getRequestMeta();
  const ipKey = hashIp(ip);
  // Every attempt from one address counts; for one account only wrong
  // passwords count, so the owner signing in often is never locked out.
  const [ipOk, accountLocked] = await Promise.all([checkLimit("loginPerIp", ipKey), isLimited("loginPerAccount", parsed.data.email)]);
  if (!ipOk || accountLocked) return errorState(RATE_LIMIT_MESSAGE, undefined, formData);

  const user = await authenticate(parsed.data.email, parsed.data.password);
  if (!user) {
    await checkLimit("loginPerAccount", parsed.data.email);
    await logAudit({ actor: null, action: "auth.login_failed", entityType: "User", summary: "Failed sign-in attempt", ipHash: ipKey, metadata: { email: parsed.data.email } });
    return errorState("The email or password is incorrect.", undefined, formData);
  }

  await clearLimit("loginPerAccount", parsed.data.email);
  await createSession(user.id, user.role, userAgent);
  await mergeGuestCart(user.id);
  if (isStaffRole(user.role)) {
    await logAudit({ actor: { id: user.id, email: user.email }, action: "auth.login", entityType: "User", entityId: user.id, summary: "Staff sign-in", ipHash: ipKey });
  }
  const fallback = isStaffRole(user.role) ? "/admin" : "/account";
  redirect(safeRedirectPath(String(formData.get("next") ?? ""), fallback));
}

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { ip, userAgent } = await getRequestMeta();
  const spam = await checkSpam(formData, ip);
  if (!spam.ok) return errorState(spamMessage(spam), undefined, formData);
  if (!(await checkLimit("register", hashIp(ip)))) return errorState(RATE_LIMIT_MESSAGE, undefined, formData);

  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    phone: formData.get("phone") ?? "",
    marketingOptIn: formData.get("marketingOptIn"),
  });
  if (!parsed.success) return errorState("Check the highlighted fields.", zodFieldErrors(parsed.error), formData);

  let user;
  try {
    user = await createUser(parsed.data);
  } catch (error) {
    if (error instanceof AccountError) {
      const field = error.message.includes("account") ? "email" : "password";
      return errorState(error.message, { [field]: error.message }, formData);
    }
    throw error;
  }

  const store = await getSettings("store");
  const token = await issueAuthToken(user.id, "EMAIL_VERIFICATION");
  await sendEmail({ to: user.email, ...verificationEmail(store.name, user.name, token) });
  await createSession(user.id, user.role, userAgent);
  await mergeGuestCart(user.id);
  redirect(safeRedirectPath(String(formData.get("next") ?? ""), "/account?welcome=1"));
}

export async function signOutAction(): Promise<void> {
  await destroyCurrentSession();
  redirect("/");
}

/** Always shows the same message so the form can't reveal which emails have accounts. */
export async function forgotPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return errorState("Enter a valid email address.", zodFieldErrors(parsed.error), formData);
  const { ip } = await getRequestMeta();
  const [ipOk, accountOk] = await Promise.all([
    checkLimit("passwordResetPerIp", hashIp(ip)),
    checkLimit("passwordResetPerAccount", parsed.data.email),
  ]);
  const genericSuccess: FormState = {
    status: "success",
    message: "If an account exists for that email, we've sent a link to reset the password. It expires in 1 hour.",
  };
  if (!ipOk || !accountOk) return genericSuccess;

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (user && !user.deletedAt && !user.disabledAt) {
    const token = await issueAuthToken(user.id, "PASSWORD_RESET");
    const store = await getSettings("store");
    await sendEmail({ to: user.email, ...passwordResetEmail(store.name, user.name, token) });
  }
  return genericSuccess;
}

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return errorState("Check the highlighted fields.", zodFieldErrors(parsed.error), formData);
  const { ip } = await getRequestMeta();
  if (!(await checkLimit("passwordResetPerIp", hashIp(ip)))) return errorState(RATE_LIMIT_MESSAGE);

  try {
    const user = await resetPasswordWithToken(parsed.data.token, parsed.data.password);
    const store = await getSettings("store");
    await sendEmail({ to: user.email, ...passwordChangedEmail(store.name, user.name) });
    await logAudit({ actor: { id: user.id, email: user.email }, action: "auth.password_reset", entityType: "User", entityId: user.id, ipHash: hashIp(ip) });
  } catch (error) {
    if (error instanceof AccountError) return errorState(error.message);
    throw error;
  }
  redirect("/login?reset=1");
}

export async function resendVerificationAction(): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return errorState("Please sign in again.");
  if (user.emailVerifiedAt) return { status: "success", message: "Your email is already confirmed." };
  if (!(await checkLimit("verificationEmail", user.id))) return errorState(RATE_LIMIT_MESSAGE);
  const store = await getSettings("store");
  const token = await issueAuthToken(user.id, "EMAIL_VERIFICATION");
  await sendEmail({ to: user.email, ...verificationEmail(store.name, user.name, token) });
  return { status: "success", message: `We sent a new confirmation link to ${user.email}.` };
}
