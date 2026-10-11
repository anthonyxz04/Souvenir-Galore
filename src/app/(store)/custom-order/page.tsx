import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth/session";
import { getAllSettings } from "@/lib/settings";
import { Container, PageHeading } from "@/components/ui/misc";
import { Notice } from "@/components/ui/form-message";
import { CustomOrderForm } from "@/components/store/custom-order-form";

export const metadata: Metadata = {
  title: "Request a custom order",
  description: "Wedding and baptism favors, corporate gifts and one-off keepsakes made to your brief. Tell us your idea and we'll reply with a quote.",
  alternates: { canonical: "/custom-order" },
};

export default async function CustomOrderPage({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  const { product: productSlug } = await searchParams;
  const [settings, user] = await Promise.all([getAllSettings(), getCurrentUser()]);
  const product = productSlug
    ? await prisma.product.findFirst({ where: { slug: productSlug, status: "ACTIVE" }, select: { id: true, name: true } })
    : null;
  return (
    <Container className="py-10 sm:py-16">
      <div className="grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <div className="space-y-6 lg:sticky lg:top-28">
            <PageHeading title="Made for your occasion" description="Favors for a hundred guests, a single engraved keepsake, a candle in your company colors — describe it and we'll take it from there." />
            <ol className="space-y-4 border-t border-line pt-6 text-[0.9375rem]">
              <li>
                <p className="font-medium">You send your idea</p>
                <p className="text-ink-soft">Quantities, colors, names and the date you need it.</p>
              </li>
              <li>
                <p className="font-medium">We reply with a quote</p>
                <p className="text-ink-soft">Usually within two working days, with any questions.</p>
              </li>
              <li>
                <p className="font-medium">You confirm, we make it</p>
                <p className="text-ink-soft">Nothing is made or charged until you agree to the quote.</p>
              </li>
            </ol>
          </div>
        </div>
        <div className="lg:col-span-8">
          {settings.commerce.customOrdersEnabled ? (
            <CustomOrderForm
              defaults={{ name: user?.name, email: user?.email, phone: user?.phone }}
              uploadsEnabled={settings.commerce.customOrderUploadsEnabled}
              maxUploadMb={Math.floor(env.uploadMaxBytes / 1024 / 1024)}
              product={product}
            />
          ) : (
            <Notice tone="info" title="Custom orders are paused">
              We&apos;re not taking new custom requests at the moment. Please contact us for anything urgent.
            </Notice>
          )}
        </div>
      </div>
    </Container>
  );
}
