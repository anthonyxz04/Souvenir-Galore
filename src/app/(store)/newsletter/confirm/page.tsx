import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { sha256 } from "@/lib/auth/crypto";
import { Container } from "@/components/ui/misc";
import { Notice } from "@/components/ui/form-message";

export const metadata: Metadata = { title: "Newsletter", robots: { index: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

export default async function ConfirmNewsletterPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  let confirmed = false;
  if (token && token.length < 200) {
    const result = await prisma.newsletterSubscriber.updateMany({
      where: { confirmTokenHash: sha256(token), status: "PENDING" },
      data: { status: "SUBSCRIBED", confirmedAt: new Date(), confirmTokenHash: null },
    });
    confirmed = result.count === 1;
  }
  return (
    <Container className="py-16">
      <div className="mx-auto max-w-xl space-y-4">
        <h1 className="font-display text-title">{confirmed ? "You're subscribed" : "Link expired"}</h1>
        <Notice tone={confirmed ? "success" : "warning"}>
          {confirmed ? "Thank you for confirming. You can unsubscribe at any time from any of our emails." : "This confirmation link is invalid or was already used. You can sign up again from the homepage."}
        </Notice>
      </div>
    </Container>
  );
}
