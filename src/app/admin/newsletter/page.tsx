import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guards";
import { isEmailConfigured } from "@/lib/email";
import { getSettings } from "@/lib/settings";
import { deleteSubscriberAction, unsubscribeSubscriberAction } from "@/server/actions/admin/content";
import { AdminPageHeader, EmptyRow, formatDate, Panel, Table, Td, Th } from "@/components/admin/admin-ui";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { NewsletterSettingsForm } from "@/components/admin/settings-forms";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Notice } from "@/components/ui/form-message";

export const metadata: Metadata = { title: "Newsletter" };

export default async function NewsletterAdmin({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireStaffPage("newsletter:manage", "/admin/newsletter");
  const { q } = await searchParams;
  const search = q?.trim().slice(0, 100);
  const [counts, subscribers, settings] = await Promise.all([
    prisma.newsletterSubscriber.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.newsletterSubscriber.findMany({ where: search ? { email: { contains: search, mode: "insensitive" } } : {}, orderBy: { createdAt: "desc" }, take: 200 }),
    getSettings("newsletter"),
  ]);
  const count = (status: string) => counts.find((c) => c.status === status)?._count._all ?? 0;
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Newsletter"
        description={`${count("SUBSCRIBED")} subscribed, ${count("PENDING")} waiting for confirmation, ${count("UNSUBSCRIBED")} unsubscribed. Export the list to send campaigns with your email marketing service (Mailchimp, Brevo, etc.).`}
        actions={
          <a href="/api/admin/newsletter/export" className={buttonClass("secondary", "sm")}>
            Export subscribers (CSV)
          </a>
        }
      />
      {settings.doubleOptIn && !isEmailConfigured() ? <Notice tone="warning">Email isn&apos;t configured, so new signups are confirmed immediately instead of by email.</Notice> : null}
      <Panel title="Signup form">
        <NewsletterSettingsForm settings={settings} />
      </Panel>
      <form method="get" className="flex gap-2">
        <label htmlFor="sub-q" className="sr-only">
          Search subscribers
        </label>
        <input id="sub-q" name="q" defaultValue={search} placeholder="Search by email" className="h-10 w-72 rounded-full border border-line-strong/70 bg-plaster px-4 text-sm focus:border-olive focus:outline-none" />
        <button type="submit" className="h-10 rounded-full bg-ink px-4 text-sm text-white">
          Search
        </button>
      </form>
      <Table>
        <thead>
          <tr>
            <Th>Email</Th>
            <Th>Status</Th>
            <Th>Joined</Th>
            <Th>Source</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {subscribers.length ? (
            subscribers.map((s) => (
              <tr key={s.id}>
                <Td>{s.email}</Td>
                <Td>
                  <Badge tone={s.status === "SUBSCRIBED" ? "success" : s.status === "PENDING" ? "warning" : "neutral"}>{s.status === "SUBSCRIBED" ? "Subscribed" : s.status === "PENDING" ? "Pending" : "Unsubscribed"}</Badge>
                </Td>
                <Td className="text-sm text-ink-soft">{formatDate(s.createdAt)}</Td>
                <Td className="text-sm text-ink-soft">{s.source ?? "—"}</Td>
                <Td>
                  <div className="flex justify-end gap-1">
                    {s.status !== "UNSUBSCRIBED" ? (
                      <form action={unsubscribeSubscriberAction}>
                        <input type="hidden" name="id" value={s.id} />
                        <button type="submit" className={buttonClass("ghost", "sm")}>
                          Unsubscribe
                        </button>
                      </form>
                    ) : null}
                    <ConfirmButton action={deleteSubscriberAction} fields={{ id: s.id }} variant="ghost" label="Erase" title="Erase this subscriber?" description="Removes the email and consent record completely (use for data-deletion requests)." confirmLabel="Erase" />
                  </div>
                </Td>
              </tr>
            ))
          ) : (
            <EmptyRow colSpan={5}>
              No subscribers yet. The signup form is on the <Link href="/" className="underline">homepage</Link>.
            </EmptyRow>
          )}
        </tbody>
      </Table>
    </div>
  );
}
