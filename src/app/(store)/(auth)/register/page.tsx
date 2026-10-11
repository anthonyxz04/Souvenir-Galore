import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { safeRedirectPath } from "@/lib/text";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Create an account", robots: { index: false } };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const next = safeRedirectPath(params.next, "");
  if (await getCurrentUser()) redirect(next || "/account");
  return (
    <AuthShell
      title="Create an account"
      intro={
        <>
          Already have one?{" "}
          <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-olive underline underline-offset-4">
            Sign in
          </Link>
        </>
      }
      aside={
        <p>
          You don&apos;t need an account to order — you can check out as a guest. An account lets you track orders, save addresses and keep a wishlist.
        </p>
      }
    >
      <RegisterForm next={next} />
    </AuthShell>
  );
}
