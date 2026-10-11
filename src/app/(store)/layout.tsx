import { SiteFooter } from "@/components/store/site-footer";
import { SiteHeader } from "@/components/store/site-header";
import { WhatsAppBubble } from "@/components/store/whatsapp-bubble";
import { getSettings } from "@/lib/settings";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const contact = await getSettings("contact");
  return (
    <>
      <a
        href="#main"
        className="sr-only-focusable fixed left-3 top-3 z-[60] rounded-full bg-ink px-4 py-2 text-sm text-white"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="focus:outline-none">
        {children}
      </main>
      <SiteFooter />
      {contact.whatsapp && contact.showWhatsappButton ? <WhatsAppBubble number={contact.whatsapp} /> : null}
    </>
  );
}
