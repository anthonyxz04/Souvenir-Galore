import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { markdownToPlainText, truncate } from "@/lib/text";
import { ContentPage } from "@/components/store/content-page";

export async function generateMetadata(): Promise<Metadata> {
  const page = await prisma.page.findFirst({ where: { slug: "about", isPublished: true } });
  return {
    title: page?.seoTitle || page?.title || "About",
    description: page ? page.seoDescription || truncate(markdownToPlainText(page.body), 160) : undefined,
    alternates: { canonical: "/about" },
  };
}

export default async function AboutPage() {
  const page = await prisma.page.findFirst({ where: { slug: "about", isPublished: true } });
  if (!page) notFound();
  return <ContentPage title={page.title} body={page.body} />;
}
