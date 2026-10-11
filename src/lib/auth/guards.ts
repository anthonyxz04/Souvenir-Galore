import "server-only";
import { notFound, redirect } from "next/navigation";
import { hasPermission, isStaffRole, type Permission } from "./permissions";
import { getCurrentSession, type SessionUser } from "./session";

export class AuthorizationError extends Error {
  constructor(message = "You don't have permission to do that.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/** For customer pages: redirects to the login page when signed out. */
export async function requireUser(returnTo: string): Promise<SessionUser> {
  const session = await getCurrentSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return session.user;
}

/**
 * For admin pages. Signed-out visitors go to the login page; signed-in users
 * without the permission get a 404 so admin pages are not revealed.
 */
export async function requireStaffPage(permission: Permission, returnTo = "/admin"): Promise<SessionUser> {
  const session = await getCurrentSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  if (!isStaffRole(session.user.role) || !hasPermission(session.user.role, permission)) notFound();
  return session.user;
}

/** For Server Actions and Route Handlers: throws unless the user has the permission. */
export async function assertPermission(permission: Permission): Promise<SessionUser> {
  const session = await getCurrentSession();
  if (!session) throw new AuthorizationError("Please sign in again.");
  if (!hasPermission(session.user.role, permission)) throw new AuthorizationError();
  return session.user;
}

/** For customer Server Actions: throws when signed out. */
export async function assertUser(): Promise<SessionUser> {
  const session = await getCurrentSession();
  if (!session) throw new AuthorizationError("Please sign in to continue.");
  return session.user;
}
