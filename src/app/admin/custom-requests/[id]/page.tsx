import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guards";
import { toMajorString } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { digitsOnly } from "@/lib/text";
import { AdminPageHeader, formatDateTime, KeyValue, Panel } from "@/components/admin/admin-ui";
import { CustomRequestForm } from "@/components/admin/sales-forms";

export const metadata: Metadata = { title: "Custom request" };

const CONTACT: Record<string, string> = { EMAIL: "Email", PHONE: "Phone call", WHATSAPP: "WhatsApp", INSTAGRAM: "Instagram" };

export default async function CustomRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStaffPage("requests:manage", `/admin/custom-requests/${id}`);
  const request = await prisma.customRequest.findUnique({
    where: { id },
    include: { attachments: { include: { asset: { select: { id: true, width: true, height: true, originalName: true } } } }, product: { select: { id: true, name: true } }, user: { select: { id: true } } },
  });
  if (!request) notFound();
  const commerce = await getSettings("commerce");
  const phone = request.phone ? digitsOnly(request.phone) : "";
  return (
    <div className="space-y-6">
      <AdminPageHeader back={{ href: "/admin/custom-requests", label: "Custom requests" }} title={`${request.number}: ${request.productType}`} description={`Received ${formatDateTime(request.createdAt)}`} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-6">
          <Panel title="Request">
            <KeyValue
              items={[
                { label: "Piece", value: request.productType },
                ...(request.product ? [{ label: "Based on", value: <Link href={`/admin/products/${request.product.id}`} className="underline">{request.product.name}</Link> }] : []),
                { label: "Occasion", value: request.occasion ?? "—" },
                { label: "Quantity", value: request.quantity ? String(request.quantity) : "—" },
                { label: "Needed by", value: request.desiredDate ? request.desiredDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "—" },
                { label: "Budget", value: request.budgetRange ?? "—" },
                { label: "Colors / design", value: <span className="whitespace-pre-line">{request.preferences ?? "—"}</span> },
                { label: "Names, dates, messages", value: <span className="whitespace-pre-line">{request.personalizationText ?? "—"}</span> },
                { label: "Details", value: <span className="whitespace-pre-line">{request.details}</span> },
              ]}
            />
          </Panel>
          {request.attachments.length ? (
            <Panel title="Reference images" description="Private — only visible to staff.">
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {request.attachments.map((attachment) => (
                  <li key={attachment.id}>
                    <a href={`/api/admin/files/${attachment.asset.id}?w=1600`} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg bg-limestone-deep">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/admin/files/${attachment.asset.id}?w=640`} alt={attachment.asset.originalName ?? "Reference image"} className="aspect-square w-full object-cover" loading="lazy" />
                    </a>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>
        <div className="space-y-6">
          <Panel title="Customer">
            <KeyValue
              items={[
                { label: "Name", value: request.name },
                { label: "Email", value: <a href={`mailto:${request.email}?subject=${encodeURIComponent(`Your custom request ${request.number}`)}`} className="underline">{request.email}</a> },
                { label: "Phone", value: request.phone ? <span className="space-x-2"><a href={`tel:${request.phone.replace(/[^\d+]/g, "")}`} className="underline">{request.phone}</a>{phone.length >= 10 ? <a href={`https://wa.me/${phone}`} target="_blank" rel="noopener noreferrer" className="text-olive underline">WhatsApp</a> : null}</span> : "—" },
                { label: "Prefers", value: request.contactPreference ? CONTACT[request.contactPreference] ?? request.contactPreference : "Email" },
                { label: "Account", value: request.user ? <Link href={`/admin/customers/${request.user.id}`} className="underline">View customer</Link> : "Guest" },
              ]}
            />
          </Panel>
          <Panel title="Status & quote">
            <CustomRequestForm
              request={{
                id: request.id,
                status: request.status,
                quotedAmount: request.quotedAmount === null ? "" : toMajorString(request.quotedAmount, commerce.currencyDecimals),
                quoteNote: request.quoteNote ?? "",
                adminNotes: request.adminNotes ?? "",
              }}
            />
          </Panel>
        </div>
      </div>
    </div>
  );
}
