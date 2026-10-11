import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guards";
import { deleteFaqAction, moveFaqAction } from "@/server/actions/admin/content";
import { AdminPageHeader, Panel } from "@/components/admin/admin-ui";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { FaqForm } from "@/components/admin/content-forms";
import { Badge } from "@/components/ui/badge";
import { ArrowDownIcon, ArrowUpIcon } from "@/components/ui/icons";

export const metadata: Metadata = { title: "FAQ" };

export default async function FaqAdmin() {
  await requireStaffPage("content:manage", "/admin/faq");
  const items = await prisma.faqItem.findMany({ orderBy: [{ category: "asc" }, { position: "asc" }] });
  return (
    <div className="space-y-6">
      <AdminPageHeader title="Frequently asked questions" description="Shown on the Questions page and to search engines." />
      <Panel title="Add a question">
        <FaqForm />
      </Panel>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id}>
            <details className="rounded-2xl bg-plaster ring-1 ring-line/70">
              <summary className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <span className="min-w-0">
                  <span className="block font-medium">{item.question}</span>
                  {item.category ? <span className="text-xs text-ink-soft">{item.category}</span> : null}
                </span>
                {!item.isPublished ? <Badge>Hidden</Badge> : null}
              </summary>
              <div className="space-y-4 border-t border-line/70 px-5 py-5">
                <FaqForm item={{ id: item.id, question: item.question, answer: item.answer, category: item.category ?? "", isPublished: item.isPublished }} />
                <div className="flex items-center gap-1 border-t border-line/70 pt-4">
                  {(["up", "down"] as const).map((direction) => (
                    <form key={direction} action={moveFaqAction}>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="direction" value={direction} />
                      <button type="submit" className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-ink/5" aria-label={`Move ${direction}`}>
                        {direction === "up" ? <ArrowUpIcon size={16} /> : <ArrowDownIcon size={16} />}
                      </button>
                    </form>
                  ))}
                  <ConfirmButton action={deleteFaqAction} fields={{ id: item.id }} variant="ghost" label="Delete" title="Delete this question?" description={item.question} confirmLabel="Delete" />
                </div>
              </div>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}
