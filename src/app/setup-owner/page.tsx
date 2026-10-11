import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { isValidSetupToken } from "@/lib/auth/setup-token";
import { SealMark } from "@/components/store/logo";
import { OwnerSetupForm } from "@/components/auth/owner-setup-form";

export const metadata: Metadata = { title: { absolute: "Set up your store | Souvenir Galore" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** One-time page that creates the store owner's account. Disappears once an owner exists. */
export default async function OwnerSetupPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!isValidSetupToken(token)) notFound();
  if ((await prisma.user.count({ where: { role: "OWNER", deletedAt: null } })) > 0) notFound();
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6 py-16">
      <div className="flex items-center gap-3">
        <SealMark size={40} />
        <span className="font-display text-2xl">Souvenir Galore</span>
      </div>
      <div className="space-y-2">
        <h1 className="font-display text-[2rem] leading-tight">Create your owner account</h1>
        <p className="text-ink-soft">This is the account you&apos;ll use to run the store from the dashboard. This page works once: after you create the account, it disappears.</p>
      </div>
      <OwnerSetupForm token={token!} />
    </main>
  );
}
