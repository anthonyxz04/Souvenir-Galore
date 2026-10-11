import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { AuthorizationError, assertPermission } from "@/lib/auth/guards";
import { csvRow } from "@/lib/csv";
import { toMajorString } from "@/lib/money";
import { getSettings } from "@/lib/settings";

export async function GET(request: Request) {
  let user;
  try {
    user = await assertPermission("orders:view");
  } catch (error) {
    if (error instanceof AuthorizationError) return new Response("Not found", { status: 404 });
    throw error;
  }
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const commerce = await getSettings("commerce");
  const d = commerce.currencyDecimals;
  const orders = await prisma.order.findMany({
    where: {
      createdAt: {
        ...(from && !Number.isNaN(Date.parse(from)) ? { gte: new Date(from) } : {}),
        ...(to && !Number.isNaN(Date.parse(to)) ? { lte: new Date(`${to}T23:59:59Z`) } : {}),
      },
    },
    orderBy: { createdAt: "asc" },
    take: 10_000,
  });
  const lines = [csvRow(["number", "created_at", "customer", "email", "phone", "status", "payment_status", "payment_method", "fulfillment", "subtotal", "discount", "delivery", "tax", "total", "refunded", "currency"])];
  for (const o of orders) {
    lines.push(
      csvRow([
        o.number,
        o.createdAt.toISOString(),
        o.customerName,
        o.email,
        o.phone,
        o.status,
        o.paymentStatus,
        o.paymentMethodName,
        o.fulfillmentMethod,
        toMajorString(o.subtotal, d),
        toMajorString(o.discountTotal, d),
        toMajorString(o.deliveryFee, d),
        toMajorString(o.taxTotal, d),
        toMajorString(o.total, d),
        toMajorString(o.refundedTotal, d),
        o.currency,
      ]),
    );
  }
  await logAudit({ actor: user, action: "orders.export", summary: `${orders.length} orders exported` });
  return new Response(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
