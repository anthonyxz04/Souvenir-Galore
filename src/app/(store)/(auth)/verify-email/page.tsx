import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { consumeAuthToken } from "@/lib/auth/service";
import { AuthShell } from "@/components/auth/auth-shell";
import { Notice } from "@/components/ui/form-message";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Confirm your email", robots: { index: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const userId = token ? await consumeAuthToken(token, "EMAIL_VERIFICATION") : null;
  if (userId) {
    await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  }
  return (
    <AuthShell title={userId ? "Email confirmed" : "We couldn't confirm your email"}>
      {userId ? (
        <div className="space-y-6">
          <Notice tone="success">Thank you — your email address is confirmed.</Notice>
          <ButtonLink href="/account">Go to your account</ButtonLink>
        </div>
      ) : (
        <Notice tone="warning">
          This link has expired or was already used. Sign in and request a new confirmation email from{" "}
          <Link href="/account" className="underline underline-offset-4">
            your account
          </Link>
          .
        </Notice>
      )}
    </AuthShell>
  );
}
