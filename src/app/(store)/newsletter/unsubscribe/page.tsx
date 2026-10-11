import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { Container } from "@/components/ui/misc";
import { Notice } from "@/components/ui/form-message";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

async function unsubscribe(formData: FormData) {
  "use server";
  const token = String(formData.get("token") ?? "");
  if (!token || token.length > 200) return;
  await prisma.newsletterSubscriber.updateMany({ where: { unsubscribeToken: token }, data: { status: "UNSUBSCRIBED", unsubscribedAt: new Date() } });
  const { redirect } = await import("next/navigation");
  redirect(`/newsletter/unsubscribe?token=${encodeURIComponent(token)}&done=1`);
}

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string; done?: string }> }) {
  const { token, done } = await searchParams;
  const subscriber = token && token.length < 200 ? await prisma.newsletterSubscriber.findUnique({ where: { unsubscribeToken: token }, select: { status: true } }) : null;
  return (
    <Container className="py-16">
      <div className="mx-auto max-w-xl space-y-5">
        <h1 className="font-display text-title">Unsubscribe</h1>
        {!subscriber ? (
          <Notice tone="warning">This unsubscribe link isn&apos;t valid.</Notice>
        ) : done || subscriber.status === "UNSUBSCRIBED" ? (
          <Notice tone="success">You&apos;ve been unsubscribed and won&apos;t receive marketing emails from us.</Notice>
        ) : (
          <form action={unsubscribe} className="space-y-4">
            <input type="hidden" name="token" value={token} />
            <p className="text-ink-soft">Stop receiving our newsletter?</p>
            <button type="submit" className="h-11 rounded-full bg-olive px-5 font-medium text-white hover:bg-olive-deep">
              Unsubscribe
            </button>
          </form>
        )}
      </div>
    </Container>
  );
}
