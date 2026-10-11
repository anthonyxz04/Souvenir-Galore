import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { AuthorizationError, assertPermission } from "@/lib/auth/guards";
import { csvRow } from "@/lib/csv";

export async function GET() {
  let user;
  try {
    user = await assertPermission("newsletter:manage");
  } catch (error) {
    if (error instanceof AuthorizationError) return new Response("Not found", { status: 404 });
    throw error;
  }
  const subscribers = await prisma.newsletterSubscriber.findMany({ where: { status: "SUBSCRIBED" }, orderBy: { createdAt: "asc" } });
  const lines = [csvRow(["email", "subscribed_at", "source", "consent_text"])];
  for (const s of subscribers) lines.push(csvRow([s.email, (s.confirmedAt ?? s.createdAt).toISOString(), s.source ?? "", s.consentText ?? ""]));
  await logAudit({ actor: user, action: "newsletter.export", summary: `${subscribers.length} subscribers exported` });
  return new Response(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="newsletter-subscribers-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
