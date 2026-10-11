import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { markdownToPlainText, truncate } from "@/lib/text";
import { ContentPage } from "@/components/store/content-page";

type Props = { params: Promise<{ slug: string }> };

async function getPage(slug: string) {
  return prisma.page.findFirst({ where: { slug, isPublished: true } });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) return { title: "Page not found" };
  return {
    title: page.seoTitle || page.title,
    description: page.seoDescription || truncate(markdownToPlainText(page.body), 160),
    alternates: { canonical: `/pages/${page.slug}` },
  };
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  if (slug === "about") permanentRedirect("/about");
  const page = await getPage(slug);
  if (!page) notFound();
  return <ContentPage title={page.title} body={page.body} updatedAt={page.updatedAt} />;
}
