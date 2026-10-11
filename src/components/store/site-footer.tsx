import Link from "next/link";
import { prisma } from "@/lib/db";
import { getNavCategories } from "@/lib/catalog/queries";
import { getAllSettings } from "@/lib/settings";
import { FacebookIcon, InstagramIcon, MailIcon, PhoneIcon, TikTokIcon, WhatsAppIcon } from "@/components/ui/icons";
import { SealMark } from "./logo";

export async function SiteFooter() {
  const [settings, categories, pages] = await Promise.all([
    getAllSettings(),
    getNavCategories(),
    prisma.page.findMany({
      where: { isPublished: true, showInFooter: true },
      orderBy: [{ position: "asc" }, { title: "asc" }],
      select: { slug: true, title: true, footerGroup: true },
    }),
  ]);
  const { contact, store } = settings;
  const policyPages = pages.filter((p) => p.footerGroup === "policies");
  const helpPages = pages.filter((p) => p.footerGroup !== "policies");
  const year = new Date().getFullYear();

  const socials = [
    contact.instagram ? { href: `https://instagram.com/${contact.instagram}`, label: "Instagram", Icon: InstagramIcon } : null,
    contact.facebookUrl ? { href: contact.facebookUrl, label: "Facebook", Icon: FacebookIcon } : null,
    contact.tiktokUrl ? { href: contact.tiktokUrl, label: "TikTok", Icon: TikTokIcon } : null,
    contact.whatsapp ? { href: `https://wa.me/${contact.whatsapp}`, label: "WhatsApp", Icon: WhatsAppIcon } : null,
  ].filter(Boolean) as { href: string; label: string; Icon: typeof InstagramIcon }[];

  const heading = "mb-4 text-sm font-semibold text-white";
  const link = "text-[0.9375rem] text-white/75 hover:text-white";

  return (
    <footer className="mt-24 bg-olive-deep text-white">
      <div className="mx-auto grid max-w-[1240px] gap-12 px-4 py-16 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr] lg:px-10">
        <div className="space-y-5">
          <Link href="/" className="inline-flex items-center gap-3 rounded-md">
            <SealMark size={40} />
            <span className="font-display text-2xl">{store.name}</span>
          </Link>
          {store.tagline ? <p className="max-w-xs text-[0.9375rem] leading-relaxed text-white/75">{store.tagline}</p> : null}
          {socials.length ? (
            <ul className="flex gap-2">
              {socials.map(({ href, label, Icon }) => (
                <li key={label}>
                  <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 w-11 items-center justify-center rounded-full ring-1 ring-white/25 hover:bg-white/10" aria-label={label}>
                    <Icon size={20} />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <nav aria-label="Shop">
          <h2 className={heading}>Shop</h2>
          <ul className="space-y-2.5">
            <li>
              <Link href="/shop" className={link}>
                All products
              </Link>
            </li>
            {categories.slice(0, 6).map((category) => (
              <li key={category.id}>
                <Link href={`/category/${category.slug}`} className={link}>
                  {category.name}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/gifts" className={link}>
                Gift finder
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Help">
          <h2 className={heading}>Help</h2>
          <ul className="space-y-2.5">
            <li>
              <Link href="/contact" className={link}>
                Contact us
              </Link>
            </li>
            <li>
              <Link href="/faq" className={link}>
                Frequently asked questions
              </Link>
            </li>
            {settings.commerce.customOrdersEnabled ? (
              <li>
                <Link href="/custom-order" className={link}>
                  Request a custom order
                </Link>
              </li>
            ) : null}
            {helpPages.map((page) => (
              <li key={page.slug}>
                <Link href={page.slug === "about" ? "/about" : `/pages/${page.slug}`} className={link}>
                  {page.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className={heading}>Get in touch</h2>
          <ul className="space-y-3 text-[0.9375rem] text-white/75">
            {contact.email ? (
              <li>
                <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-2 hover:text-white">
                  <MailIcon size={18} /> {contact.email}
                </a>
              </li>
            ) : null}
            {contact.phone ? (
              <li>
                <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-2 hover:text-white">
                  <PhoneIcon size={18} /> {contact.phone}
                </a>
              </li>
            ) : null}
            {contact.address ? <li className="whitespace-pre-line">{contact.address}</li> : null}
            {contact.hours ? <li className="whitespace-pre-line">{contact.hours}</li> : null}
            {!contact.email && !contact.phone && !contact.address ? (
              <li>
                <Link href="/contact" className="hover:text-white">
                  Send us a message
                </Link>
              </li>
            ) : null}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/15">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-3 px-4 py-6 text-sm text-white/65 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-10">
          <p>
            © {year} {store.name}. Handmade in Lebanon.
          </p>
          {policyPages.length ? (
            <ul className="flex flex-wrap gap-x-5 gap-y-2">
              {policyPages.map((page) => (
                <li key={page.slug}>
                  <Link href={`/pages/${page.slug}`} className="hover:text-white">
                    {page.title}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
