import "server-only";
import { AuthorizationError, assertPermission } from "@/lib/auth/guards";
import type { Permission } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/session";
import { errorState, type FormState } from "@/lib/validation/forms";
import { OrderActionError } from "@/lib/orders/service";
import { AccountError } from "@/lib/auth/service";
import { CheckoutError } from "@/lib/checkout/place-order";
import { ImageValidationError } from "@/lib/storage/process";

/** Known, user-safe errors whose message can be shown in the admin UI. */
export class AdminActionError extends Error {}

function isSafeError(error: unknown): error is Error {
  return (
    error instanceof AuthorizationError ||
    error instanceof AdminActionError ||
    error instanceof OrderActionError ||
    error instanceof AccountError ||
    error instanceof CheckoutError ||
    error instanceof ImageValidationError
  );
}

/**
 * Runs an admin Server Action after checking the permission on the server.
 * Expected errors become form messages; anything else is logged and a generic
 * message is shown (no internal details leak to the browser).
 */
export async function guarded(permission: Permission, run: (user: SessionUser) => Promise<FormState>): Promise<FormState> {
  let user: SessionUser;
  try {
    user = await assertPermission(permission);
  } catch (error) {
    if (error instanceof AuthorizationError) return errorState(error.message);
    throw error;
  }
  try {
    return await run(user);
  } catch (error) {
    if (isSafeError(error)) return errorState(error.message);
    if (error instanceof Error && "code" in error && (error as { code?: string }).code === "P2002") {
      return errorState("That value is already in use (for example a URL or SKU). Choose a different one.");
    }
    if (isNextControlFlow(error)) throw error;
    console.error(`[admin:${permission}]`, error);
    return errorState("Something went wrong while saving. Nothing was changed — please try again.");
  }
}

/** For form actions that return nothing (buttons). Throws when not permitted. */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  return assertPermission(permission);
}

function isNextControlFlow(error: unknown): boolean {
  const digest = (error as { digest?: string } | null)?.digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND") || digest.startsWith("NEXT_HTTP_ERROR"));
}

export function actorOf(user: SessionUser) {
  return { id: user.id, email: user.email, name: user.name };
}
