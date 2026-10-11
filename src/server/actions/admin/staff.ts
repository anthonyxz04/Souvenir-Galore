"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { destroyUserSessions } from "@/lib/auth/session";
import { ROLES, type Role } from "@/lib/domain";
import { normalizeEmail } from "@/lib/text";
import { errorState, zodFieldErrors, type FormState } from "@/lib/validation/forms";
import { actorOf, AdminActionError, guarded, requirePermission } from "@/server/guard";

export async function setUserRoleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return guarded("staff:manage", async (user) => {
    const parsed = z.object({ email: z.string().trim().email("Enter the email of an existing account.").max(200), role: z.enum(ROLES) }).safeParse(Object.fromEntries(formData));
    if (!parsed.success) return errorState("Check the highlighted fields.", zodFieldErrors(parsed.error), formData);
    const email = normalizeEmail(parsed.data.email);
    const target = await prisma.user.findUnique({ where: { email } });
    if (!target || target.deletedAt) {
      return errorState("No account uses this email. Ask the person to create an account on the store first, then add them here.", { email: "No account found." }, formData);
    }
    if (target.id === user.id) throw new AdminActionError("You can't change your own role.");
    const newRole = parsed.data.role as Role;
    if (target.role === "OWNER" && newRole !== "OWNER") {
      const owners = await prisma.user.count({ where: { role: "OWNER", deletedAt: null, disabledAt: null } });
      if (owners <= 1) throw new AdminActionError("The store must keep at least one owner.");
    }
    if (newRole !== "CUSTOMER" && !target.emailVerifiedAt) {
      return errorState("This person must confirm their email address before getting dashboard access.", { email: "Email not confirmed yet." }, formData);
    }
    await prisma.user.update({ where: { id: target.id }, data: { role: newRole } });
    // Role changes take effect on the next sign-in; end existing sessions so permissions refresh.
    await destroyUserSessions(target.id);
    await logAudit({ actor: actorOf(user), action: "staff.role", entityType: "User", entityId: target.id, summary: `${target.email}: ${target.role} → ${newRole}` });
    revalidatePath("/admin/staff");
    return { status: "success", message: `${target.name} is now ${newRole === "CUSTOMER" ? "a customer (no dashboard access)" : newRole.toLowerCase()}. They'll need to sign in again.` };
  });
}

export async function setUserDisabledAction(formData: FormData): Promise<void> {
  const actor = await requirePermission("staff:manage");
  const userId = String(formData.get("userId") ?? "");
  const disabled = formData.get("disabled") === "true";
  if (userId === actor.id) return;
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, role: true } });
  if (!target) return;
  if (disabled && target.role === "OWNER") {
    const owners = await prisma.user.count({ where: { role: "OWNER", deletedAt: null, disabledAt: null } });
    if (owners <= 1) return;
  }
  await prisma.user.update({ where: { id: userId }, data: { disabledAt: disabled ? new Date() : null } });
  if (disabled) await destroyUserSessions(userId);
  await logAudit({ actor: actorOf(actor), action: disabled ? "user.disable" : "user.enable", entityType: "User", entityId: userId, summary: target.email });
  revalidatePath(`/admin/customers/${userId}`);
  revalidatePath("/admin/staff");
}
