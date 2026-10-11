import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { signOutOtherSessionsAction } from "@/server/actions/account";
import { ChangePasswordForm, DeleteAccountForm } from "@/components/account/account-forms";

export const metadata: Metadata = { title: "Password & security" };

export default async function SecurityPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login?next=/account/security");
  const otherSessions = await prisma.session.count({ where: { userId: session.user.id, id: { not: session.sessionId }, expiresAt: { gt: new Date() } } });
  const isStaff = session.user.role !== "CUSTOMER";
  return (
    <div className="space-y-12">
      <h1 className="font-display text-[2.25rem] leading-tight sm:text-title">Password & security</h1>

      <section aria-labelledby="password-heading" className="space-y-4">
        <h2 id="password-heading" className="font-display text-2xl">
          Change password
        </h2>
        <ChangePasswordForm />
      </section>

      <section aria-labelledby="sessions-heading" className="space-y-3 border-t border-line pt-10">
        <h2 id="sessions-heading" className="font-display text-2xl">
          Signed-in devices
        </h2>
        <p className="text-ink-soft">
          {otherSessions === 0 ? "You're only signed in on this device." : `You're signed in on ${otherSessions} other ${otherSessions === 1 ? "device" : "devices"}.`}
        </p>
        {otherSessions > 0 ? (
          <form action={signOutOtherSessionsAction}>
            <button type="submit" className="h-11 rounded-full px-5 text-[0.9375rem] ring-1 ring-ink/25 hover:bg-plaster">
              Sign out other devices
            </button>
          </form>
        ) : null}
      </section>

      <section aria-labelledby="delete-heading" className="space-y-3 border-t border-line pt-10">
        <h2 id="delete-heading" className="font-display text-2xl">
          Delete account
        </h2>
        {isStaff ? (
          <p className="text-ink-soft">Staff accounts can be removed by the store owner in the dashboard.</p>
        ) : (
          <>
            <p className="max-w-xl text-ink-soft">
              This removes your profile, addresses, wishlist and saved cart, and signs you out everywhere. Records of past orders are kept for accounting, without a login attached. This can&apos;t be undone.
            </p>
            <DeleteAccountForm />
          </>
        )}
      </section>
    </div>
  );
}
