import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Container } from "@/components/ui/misc";

export function ContentPage({ title, body, updatedAt }: { title: string; body: string; updatedAt?: Date }) {
  return (
    <Container className="py-10 sm:py-16">
      <article className="mx-auto max-w-3xl">
        <h1 className="font-display text-[2.5rem] leading-[1.08] sm:text-display">{title}</h1>
        {updatedAt ? <p className="mt-3 text-sm text-ink-soft">Last updated {updatedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p> : null}
        <div className="prose-sg mt-10">
          <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>
            {body}
          </ReactMarkdown>
        </div>
      </article>
    </Container>
  );
}
