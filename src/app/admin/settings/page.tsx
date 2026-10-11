import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guards";
import { isEmailConfigured } from "@/lib/email";
import { getAllSettings } from "@/lib/settings";
import { publicMediaBase } from "@/lib/storage";
import { mediaUrl } from "@/lib/storage/urls";
import { cn } from "@/lib/utils";
import { AdminPageHeader, Panel } from "@/components/admin/admin-ui";
import { AnnouncementForm, CommerceSettingsForm, ContactSettingsForm, NewsletterSettingsForm, SeoSettingsForm, StoreSettingsForm } from "@/components/admin/settings-forms";
import { Notice } from "@/components/ui/form-message";

export const metadata: Metadata = { title: "Settings" };

const TABS = [
  { key: "store", label: "Business" },
  { key: "contact", label: "Contact & social" },
  { key: "commerce", label: "Prices & checkout" },
  { key: "announcement", label: "Announcement bar" },
  { key: "newsletter", label: "Newsletter" },
  { key: "seo", label: "Search engines" },
] as const;

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireStaffPage("settings:manage", "/admin/settings");
  const { tab: rawTab } = await searchParams;
  const tab = TABS.some((t) => t.key === rawTab) ? (rawTab as (typeof TABS)[number]["key"]) : "store";
  const [settings, productCount] = await Promise.all([getAllSettings(), prisma.product.count()]);
  const logo = settings.store.logoAssetId ? await prisma.mediaAsset.findUnique({ where: { id: settings.store.logoAssetId }, select: { key: true, renditions: true } }) : null;

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Settings" description="Delivery and pickup are under Delivery & pickup; payment methods under Payments." />
      {!isEmailConfigured() ? (
        <Notice tone="warning" title="Email isn't set up">
          Order confirmations, password resets and email verification need an email provider. Add the SMTP settings in your hosting environment (see docs/DEPLOYMENT.md).
        </Notice>
      ) : null}
      <nav aria-label="Settings sections" className="scrollbar-none -mx-4 flex gap-1 overflow-x-auto px-4">
        {TABS.map((t) => (
          <Link key={t.key} href={`/admin/settings?tab=${t.key}`} aria-current={t.key === tab ? "page" : undefined} className={cn("shrink-0 rounded-full px-4 py-2 text-sm", t.key === tab ? "bg-ink text-white" : "bg-plaster ring-1 ring-line hover:ring-ink/30")}>
            {t.label}
          </Link>
        ))}
      </nav>
      <Panel>
        {tab === "store" ? <StoreSettingsForm settings={settings.store} logoUrl={logo ? mediaUrl(publicMediaBase(), logo, 320) : null} /> : null}
        {tab === "contact" ? <ContactSettingsForm settings={settings.contact} /> : null}
        {tab === "commerce" ? <CommerceSettingsForm settings={settings.commerce} currencyLocked={productCount > 0} /> : null}
        {tab === "announcement" ? <AnnouncementForm settings={settings.announcement} /> : null}
        {tab === "newsletter" ? <NewsletterSettingsForm settings={settings.newsletter} /> : null}
        {tab === "seo" ? <SeoSettingsForm settings={settings.seo} /> : null}
      </Panel>
    </div>
  );
}
