import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guards";
import { SECTION_TYPE_INFO } from "@/lib/content/home";
import { addHomeSectionAction, moveHomeSectionAction, toggleHomeSectionAction } from "@/server/actions/admin/content";
import { AdminPageHeader, formatDate, Panel } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { ArrowDownIcon, ArrowUpIcon } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Homepage" };

export default async function HomepageAdmin() {
  await requireStaffPage("content:manage", "/admin/homepage");
  const sections = await prisma.homeSection.findMany({ orderBy: { position: "asc" } });
  const now = new Date();
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Homepage"
        description="Arrange the sections customers see on the homepage. Keep it focused — a few strong sections beat many."
        actions={
          <Link href="/" target="_blank" className={buttonClass("secondary", "sm")}>
            View homepage
          </Link>
        }
      />
      <ol className="space-y-2">
        {sections.map((section, index) => {
          const scheduled = (section.startsAt && section.startsAt > now) || (section.endsAt && section.endsAt < now);
          return (
            <li key={section.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-plaster p-4 ring-1 ring-line/70">
              <div className="flex flex-col">
                {(["up", "down"] as const).map((direction) => (
                  <form key={direction} action={moveHomeSectionAction}>
                    <input type="hidden" name="id" value={section.id} />
                    <input type="hidden" name="direction" value={direction} />
                    <button
                      type="submit"
                      disabled={(direction === "up" && index === 0) || (direction === "down" && index === sections.length - 1)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-ink/5 disabled:opacity-30"
                      aria-label={`Move ${section.title ?? SECTION_TYPE_INFO[section.type].label} ${direction}`}
                    >
                      {direction === "up" ? <ArrowUpIcon size={15} /> : <ArrowDownIcon size={15} />}
                    </button>
                  </form>
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-ink-soft">{SECTION_TYPE_INFO[section.type].label}</p>
                <Link href={`/admin/homepage/${section.id}`} className="font-medium hover:underline">
                  {section.title || "Untitled"}
                </Link>
                {section.startsAt || section.endsAt ? (
                  <p className="text-xs text-ink-soft">
                    Scheduled {formatDate(section.startsAt)} – {formatDate(section.endsAt)}
                  </p>
                ) : null}
              </div>
              <Badge tone={section.isVisible && !scheduled ? "success" : "neutral"}>{section.isVisible ? (scheduled ? "Scheduled" : "Visible") : "Hidden"}</Badge>
              <form action={toggleHomeSectionAction}>
                <input type="hidden" name="id" value={section.id} />
                <button type="submit" className={buttonClass("ghost", "sm")}>
                  {section.isVisible ? "Hide" : "Show"}
                </button>
              </form>
              <Link href={`/admin/homepage/${section.id}`} className={buttonClass("secondary", "sm")}>
                Edit
              </Link>
            </li>
          );
        })}
      </ol>
      <Panel title="Add a section">
        <form action={addHomeSectionAction} className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm">
            <span className="block text-ink-soft">Section type</span>
            <select name="type" className="h-10 rounded-full border border-line-strong/70 bg-white pl-4 pr-8 text-sm">
              {Object.entries(SECTION_TYPE_INFO).map(([type, info]) => (
                <option key={type} value={type}>
                  {info.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={buttonClass("primary", "sm")}>
            Add section
          </button>
        </form>
        <p className="mt-3 text-sm text-ink-soft">New sections start hidden so you can set them up first.</p>
      </Panel>
    </div>
  );
}
