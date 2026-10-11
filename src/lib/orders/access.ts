import "server-only";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "../db";
import { sha256 } from "../auth/crypto";
import { getCurrentUser } from "../auth/session";
import { hasPermission } from "../auth/permissions";

function tokenMatches(token: string | null | undefined, hash: string | null): boolean {
  if (!token || !hash || token.length > 200) return false;
  const a = Buffer.from(sha256(token));
  const b = Buffer.from(hash);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Who may see an order: the customer who placed it (signed in), anyone with the
 * private link from the confirmation email, or staff with order permissions.
 * Returns null otherwise — callers respond with 404 so order numbers can't be probed.
 */
export async function loadAccessibleOrder(where: { number?: string; id?: string }, token?: string | null) {
  const order = await prisma.order.findUnique({
    where: where.id ? { id: where.id } : { number: where.number ?? "" },
    include: {
      items: true,
      events: { where: { isInternal: false }, orderBy: { createdAt: "asc" } },
      payments: { orderBy: { createdAt: "desc" } },
      paymentMethod: { select: { allowCustomerReference: true, instructions: true, type: true, config: true, name: true } },
    },
  });
  if (!order) return null;
  const user = await getCurrentUser();
  const isOwner = Boolean(user && order.userId && order.userId === user.id);
  const isStaff = Boolean(user && hasPermission(user.role, "orders:view"));
  const hasToken = tokenMatches(token, order.accessTokenHash);
  if (!isOwner && !isStaff && !hasToken) return null;
  return { order, viewer: { isOwner, isStaff, hasToken, userId: user?.id ?? null, name: user?.name ?? order.customerName } };
}

export type AccessibleOrder = NonNullable<Awaited<ReturnType<typeof loadAccessibleOrder>>>;
