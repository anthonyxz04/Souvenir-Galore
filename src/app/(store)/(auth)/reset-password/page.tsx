import type { Metadata } from "next";
import Link from "next/link";
import { peekAuthToken } from "@/lib/auth/service";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/auth-forms";
import { Notice } from "@/components/ui/form-message";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false }, referrer: "no-referrer" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const valid = await peekAuthToken(token, "PASSWORD_RESET");
  return (
    <AuthShell title="Choose a new password">
      {valid ? (
        <ResetPasswordForm token={token} />
      ) : (
        <Notice tone="warning" title="This link has expired or was already used">
          <Link href="/forgot-password" className="underline underline-offset-4">
            Request a new reset link
          </Link>
        </Notice>
      )}
    </AuthShell>
  );
}
