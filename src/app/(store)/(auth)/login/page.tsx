import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { safeRedirectPath } from "@/lib/text";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/auth-forms";
import { Notice } from "@/components/ui/form-message";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const next = safeRedirectPath(params.next, "");
  if (await getCurrentUser()) redirect(next || "/account");
  return (
    <AuthShell
      title="Sign in"
      intro={
        <>
          New here?{" "}
          <Link href={`/register${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-olive underline underline-offset-4">
            Create an account
          </Link>
        </>
      }
      aside={
        <>
          <p className="font-display text-xl text-ink">Your account keeps</p>
          <ul className="mt-3 list-disc space-y-1.5 pl-5">
            <li>your cart, on every device</li>
            <li>saved addresses for quicker checkout</li>
            <li>order tracking and history</li>
            <li>a wishlist of pieces you love</li>
          </ul>
        </>
      }
    >
      {params.reset ? <Notice tone="success">Your password was changed. Sign in with your new password.</Notice> : null}
      <LoginForm next={next} />
    </AuthShell>
  );
}
