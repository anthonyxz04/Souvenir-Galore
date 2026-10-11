import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import { getAllSettings } from "@/lib/settings";
import { Container, PageHeading } from "@/components/ui/misc";
import { InstagramIcon, MailIcon, PhoneIcon, WhatsAppIcon } from "@/components/ui/icons";
import { ContactForm } from "@/components/store/contact-form";

export const metadata: Metadata = { title: "Contact", description: "Questions about an order, a custom piece or delivery? Get in touch.", alternates: { canonical: "/contact" } };

export default async function ContactPage() {
  const [settings, user] = await Promise.all([getAllSettings(), getCurrentUser()]);
  const { contact } = settings;
  const channel = "flex items-center gap-3 rounded-2xl bg-plaster p-4 text-[0.9375rem] hover:bg-white";
  return (
    <Container className="py-10 sm:py-16">
      <div className="grid gap-12 lg:grid-cols-12">
        <div className="space-y-8 lg:col-span-5">
          <PageHeading title="Get in touch" description="Questions about an order, a custom piece or delivery — we're happy to help." />
          <ul className="space-y-3">
            {contact.whatsapp ? (
              <li>
                <a href={`https://wa.me/${contact.whatsapp}`} target="_blank" rel="noopener noreferrer" className={channel}>
                  <WhatsAppIcon /> <span>WhatsApp us</span>
                </a>
              </li>
            ) : null}
            {contact.instagram ? (
              <li>
                <a href={`https://ig.me/m/${contact.instagram}`} target="_blank" rel="noopener noreferrer" className={channel}>
                  <InstagramIcon /> <span>Message @{contact.instagram} on Instagram</span>
                </a>
              </li>
            ) : null}
            {contact.email ? (
              <li>
                <a href={`mailto:${contact.email}`} className={channel}>
                  <MailIcon /> <span>{contact.email}</span>
                </a>
              </li>
            ) : null}
            {contact.phone ? (
              <li>
                <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} className={channel}>
                  <PhoneIcon /> <span>{contact.phone}</span>
                </a>
              </li>
            ) : null}
          </ul>
          {contact.address || contact.hours ? (
            <div className="space-y-1 text-[0.9375rem] text-ink-soft">
              {contact.address ? <p className="whitespace-pre-line">{contact.address}</p> : null}
              {contact.hours ? <p className="whitespace-pre-line">{contact.hours}</p> : null}
            </div>
          ) : null}
          <p className="text-[0.9375rem] text-ink-soft">Messages here are questions, not orders. For a custom piece, the custom order form helps us quote faster.</p>
        </div>
        <div className="lg:col-span-7">
          <ContactForm defaults={{ name: user?.name, email: user?.email }} />
        </div>
      </div>
    </Container>
  );
}
