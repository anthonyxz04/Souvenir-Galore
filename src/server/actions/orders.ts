"use server";

import { revalidatePath } from "next/cache";
import { absoluteUrl, env } from "@/lib/env";
import { hashIp } from "@/lib/auth/crypto";
import { sendEmail } from "@/lib/email";
import { adminNotificationEmail } from "@/lib/email/templates";
import { loadAccessibleOrder } from "@/lib/orders/access";
import { OrderActionError, requestCancellation, submitPaymentReference } from "@/lib/orders/service";
import { checkLimit, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { getRequestMeta } from "@/lib/request";
import { getSettings } from "@/lib/settings";
import { errorState, paymentReferenceSchema, zodFieldErrors, type FormState } from "@/lib/validation/forms";

/** Customer reports a manual payment. The order moves to "Payment under review" — never to "Paid". */
export async function submitPaymentReferenceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = paymentReferenceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return errorState("Check the highlighted fields.", zodFieldErrors(parsed.error), formData);
  const { ip } = await getRequestMeta();
  if (!(await checkLimit("paymentReference", hashIp(ip)))) return errorState(RATE_LIMIT_MESSAGE);

  const access = await loadAccessibleOrder({ id: parsed.data.orderId }, parsed.data.token);
  if (!access || (!access.viewer.isOwner && !access.viewer.hasToken)) return errorState("We couldn't find this order.");

  try {
    await submitPaymentReference(access.order.id, { reference: parsed.data.reference, note: parsed.data.note }, { id: access.viewer.userId, name: access.viewer.name });
  } catch (error) {
    if (error instanceof OrderActionError) return errorState(error.message);
    throw error;
  }

  if (env.adminNotificationEmails.length) {
    const store = await getSettings("store");
    await sendEmail({
      to: env.adminNotificationEmails,
      ...adminNotificationEmail(
        store.name,
        `Payment to verify: ${access.order.number}`,
        [
          { label: "Customer", value: access.order.customerName },
          { label: "Method", value: access.order.paymentMethodName },
          { label: "Reference", value: parsed.data.reference },
        ],
        absoluteUrl(`/admin/orders/${access.order.id}`),
      ),
    });
  }
  revalidatePath(`/order/${access.order.number}`);
  revalidatePath(`/account/orders/${access.order.number}`);
  return { status: "success", message: "Thank you — we've received your payment details. We'll confirm once we've verified the payment." };
}

export async function requestCancellationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const orderId = String(formData.get("orderId") ?? "");
  const token = String(formData.get("token") ?? "") || null;
  const reason = String(formData.get("reason") ?? "");
  const access = await loadAccessibleOrder({ id: orderId }, token);
  if (!access || (!access.viewer.isOwner && !access.viewer.hasToken)) return errorState("We couldn't find this order.");
  try {
    await requestCancellation(access.order.id, reason, { id: access.viewer.userId, name: access.viewer.name });
  } catch (error) {
    if (error instanceof OrderActionError) return errorState(error.message);
    throw error;
  }
  if (env.adminNotificationEmails.length) {
    const store = await getSettings("store");
    await sendEmail({
      to: env.adminNotificationEmails,
      ...adminNotificationEmail(store.name, `Cancellation requested: ${access.order.number}`, [{ label: "Reason", value: reason || "—" }], absoluteUrl(`/admin/orders/${access.order.id}`)),
    });
  }
  revalidatePath(`/order/${access.order.number}`);
  revalidatePath(`/account/orders/${access.order.number}`);
  return { status: "success", message: "Your cancellation request was sent. We'll confirm by email." };
}
