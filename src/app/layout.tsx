import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { headers } from "next/headers";
import { connection } from "next/server";
import "./globals.css";
import { Analytics } from "@/components/analytics";
import { absoluteUrl, env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { publicMediaBase } from "@/lib/storage";
import { mediaUrl } from "@/lib/storage/urls";
import { getAllSettings } from "@/lib/settings";

const marcellus = localFont({
  src: "./fonts/marcellus-latin-400-normal.woff2",
  variable: "--font-marcellus",
  weight: "400",
  display: "swap",
});

const figtree = localFont({
  src: [
    { path: "./fonts/figtree-latin-wght-normal.woff2", weight: "300 900", style: "normal" },
    { path: "./fonts/figtree-latin-wght-italic.woff2", weight: "300 900", style: "italic" },
  ],
  variable: "--font-figtree",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  // Every page reads store settings from the database, so nothing is
  // prerendered at build time (the build never needs database access).
  await connection();
  // A Netlify deploy built before its settings existed shows only the setup page (no database).
  if (process.env.BUILD_SETUP_MISSING) return { title: "Souvenir Galore", robots: { index: false, follow: false } };
  const { seo, store } = await getAllSettings();
  // Social sharing image: the one chosen in Settings → Search engines, otherwise
  // the branded default card (public/og-image.png).
  const ogAsset = seo.ogImageAssetId
    ? await prisma.mediaAsset.findUnique({ where: { id: seo.ogImageAssetId }, select: { key: true, renditions: true, width: true, height: true } })
    : null;
  const base = publicMediaBase();
  const ogImage = ogAsset
    ? { url: mediaUrl(base.startsWith("http") ? base : absoluteUrl(base), ogAsset, 1600), alt: store.name }
    : { url: "/og-image.png", width: 1200, height: 630, alt: store.name };
  const title = seo.defaultTitle || store.name;
  return {
    metadataBase: new URL(env.appUrl),
    title: { default: title, template: `%s | ${store.name}` },
    description: seo.defaultDescription,
    applicationName: store.name,
    appleWebApp: { title: store.name },
    openGraph: { siteName: store.name, title, description: seo.defaultDescription, type: "website", locale: "en_US", images: [ogImage] },
    twitter: { card: "summary_large_image", title, description: seo.defaultDescription, images: [ogImage.url] },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#eee8df",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" className={`${marcellus.variable} ${figtree.variable}`}>
      <body className="min-h-dvh">
        {children}
        <Analytics nonce={nonce} />
      </body>
    </html>
  );
}
