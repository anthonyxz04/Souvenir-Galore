"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { hashIp } from "@/lib/auth/crypto";
import { AccountError, createUser } from "@/lib/auth/service";
import { createSession } from "@/lib/auth/session";
import { isValidSetupToken } from "@/lib/auth/setup-token";
import { checkLimit, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { getRequestMeta } from "@/lib/request";
import { errorState, registerSchema, zodFieldErrors, type FormState } from "@/lib/validation/forms";

/** Creates the first owner account from the one-time setup link. */
export async function createFirstOwnerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { ip, userAgent } = await getRequestMeta();
  if (!(await checkLimit("register", hashIp(ip)))) return errorState(RATE_LIMIT_MESSAGE);
  if (!isValidSetupToken(String(formData.get("token") ?? ""))) return errorState("This setup link isn't valid.");
  if ((await prisma.user.count({ where: { role: "OWNER", deletedAt: null } })) > 0) {
    return errorState("An owner account already exists. Sign in instead.");
  }

  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    phone: "",
    marketingOptIn: null,
  });
  if (!parsed.success) return errorState("Check the highlighted fields.", zodFieldErrors(parsed.error), formData);

  let user;
  try {
    user = await createUser({ ...parsed.data, role: "OWNER", emailVerified: true });
  } catch (error) {
    if (error instanceof AccountError) {
      const field = error.message.includes("account") ? "email" : "password";
      return errorState(error.message, { [field]: error.message }, formData);
    }
    throw error;
  }
  await logAudit({ actor: { id: user.id, email: user.email }, action: "staff.create_owner", entityType: "User", entityId: user.id, summary: `${user.email} created as owner from the setup link`, ipHash: hashIp(ip) });
  await createSession(user.id, user.role, userAgent);
  redirect("/admin");
}
