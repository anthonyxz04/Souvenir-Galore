/**
 * Plain, accessible transactional email templates. All dynamic values are
 * HTML-escaped. Each template returns both HTML and plain-text bodies.
 */

import { absoluteUrl } from "../env";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type Block =
  | { type: "p"; text: string }
  | { type: "button"; label: string; href: string }
  | { type: "rows"; rows: { label: string; value: string }[] }
  | { type: "note"; text: string };

function render(storeName: string, heading: string, blocks: Block[]): { html: string; text: string } {
  const htmlBlocks = blocks
    .map((block) => {
      switch (block.type) {
        case "p":
          return `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#2b2724;">${escapeHtml(block.text).replace(/\n/g, "<br>")}</p>`;
        case "note":
          return `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#6f655c;">${escapeHtml(block.text).replace(/\n/g, "<br>")}</p>`;
        case "button":
          return `<p style="margin:24px 0;"><a href="${escapeHtml(block.href)}" style="display:inline-block;background:#3e4a2f;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-size:15px;">${escapeHtml(block.label)}</a></p>`;
        case "rows":
          return `<table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 20px;">${block.rows
            .map(
              (row) =>
                `<tr><td style="padding:8px 0;border-bottom:1px solid #e6dfd5;color:#6f655c;font-size:14px;vertical-align:top;">${escapeHtml(row.label)}</td><td style="padding:8px 0;border-bottom:1px solid #e6dfd5;text-align:right;font-size:14px;color:#2b2724;">${escapeHtml(row.value).replace(/\n/g, "<br>")}</td></tr>`,
            )
            .join("")}</table>`;
      }
    })
    .join("\n");

  const html = `<!doctype html><html><body style="margin:0;background:#eee8df;padding:24px 12px;font-family:Helvetica,Arial,sans-serif;">
<table role="presentation" style="max-width:560px;margin:0 auto;background:#fbf9f5;border-radius:12px;padding:32px;width:100%;">
<tr><td>
<p style="margin:0 0 24px;font-family:Georgia,serif;font-size:20px;color:#3e4a2f;">${escapeHtml(storeName)}</p>
<h1 style="margin:0 0 20px;font-family:Georgia,serif;font-weight:normal;font-size:24px;color:#2b2724;">${escapeHtml(heading)}</h1>
${htmlBlocks}
</td></tr></table>
<p style="text-align:center;font-size:12px;color:#6f655c;margin-top:16px;">${escapeHtml(storeName)}</p>
</body></html>`;

  const text = [
    heading,
    "",
    ...blocks.map((block) => {
      switch (block.type) {
        case "p":
        case "note":
          return block.text;
        case "button":
          return `${block.label}: ${block.href}`;
        case "rows":
          return block.rows.map((row) => `${row.label}: ${row.value}`).join("\n");
      }
    }),
    "",
    `— ${storeName}`,
  ].join("\n\n");

  return { html, text };
}

export function verificationEmail(storeName: string, name: string, token: string) {
  const link = absoluteUrl(`/verify-email?token=${encodeURIComponent(token)}`);
  return {
    subject: `Confirm your email for ${storeName}`,
    ...render(storeName, "Confirm your email address", [
      { type: "p", text: `Hi ${name}, please confirm this is your email address.` },
      { type: "button", label: "Confirm email", href: link },
      { type: "note", text: "This link expires in 24 hours. If you didn't create an account, you can ignore this email." },
    ]),
  };
}

export function passwordResetEmail(storeName: string, name: string, token: string) {
  const link = absoluteUrl(`/reset-password?token=${encodeURIComponent(token)}`);
  return {
    subject: `Reset your ${storeName} password`,
    ...render(storeName, "Reset your password", [
      { type: "p", text: `Hi ${name}, we received a request to reset your password.` },
      { type: "button", label: "Choose a new password", href: link },
      { type: "note", text: "This link expires in 1 hour and can be used once. If you didn't ask for this, you can ignore this email — your password won't change." },
    ]),
  };
}

export function passwordChangedEmail(storeName: string, name: string) {
  return {
    subject: `Your ${storeName} password was changed`,
    ...render(storeName, "Your password was changed", [
      { type: "p", text: `Hi ${name}, the password for your account was just changed and other devices were signed out.` },
      { type: "note", text: "If this wasn't you, reset your password straight away and contact us." },
    ]),
  };
}

export type OrderEmailData = {
  number: string;
  customerName: string;
  items: { name: string; quantity: number; total: string; details?: string }[];
  subtotal: string;
  discount?: string;
  delivery: string;
  tax?: string;
  total: string;
  fulfillment: string;
  paymentMethod: string;
  paymentInstructions?: string;
  paymentDetails?: { label: string; value: string }[];
  orderUrl: string;
};

export function orderConfirmationEmail(storeName: string, order: OrderEmailData) {
  const blocks: Block[] = [
    { type: "p", text: `Thank you, ${order.customerName}. We've received your order ${order.number}.` },
    {
      type: "rows",
      rows: order.items.map((item) => ({
        label: `${item.quantity} × ${item.name}${item.details ? `\n${item.details}` : ""}`,
        value: item.total,
      })),
    },
    {
      type: "rows",
      rows: [
        { label: "Subtotal", value: order.subtotal },
        ...(order.discount ? [{ label: "Discount", value: `−${order.discount}` }] : []),
        { label: order.fulfillment, value: order.delivery },
        ...(order.tax ? [{ label: "Tax", value: order.tax }] : []),
        { label: "Total", value: order.total },
        { label: "Payment", value: order.paymentMethod },
      ],
    },
  ];
  if (order.paymentInstructions || order.paymentDetails?.length) {
    blocks.push({ type: "p", text: "How to pay" });
    if (order.paymentDetails?.length) blocks.push({ type: "rows", rows: order.paymentDetails });
    if (order.paymentInstructions) blocks.push({ type: "p", text: order.paymentInstructions });
    blocks.push({
      type: "note",
      text: `Use ${order.number} as the payment reference. Your order is confirmed as paid only after we verify the payment.`,
    });
  }
  blocks.push({ type: "button", label: "View your order", href: order.orderUrl });
  return { subject: `Order ${order.number} received — ${storeName}`, ...render(storeName, "Order received", blocks) };
}

export function adminNewOrderEmail(storeName: string, order: OrderEmailData, adminUrl: string) {
  return {
    subject: `New order ${order.number} — ${order.total}`,
    ...render(storeName, `New order ${order.number}`, [
      { type: "p", text: `${order.customerName} placed an order for ${order.total} (${order.paymentMethod}, ${order.fulfillment.toLowerCase()}).` },
      { type: "rows", rows: order.items.map((item) => ({ label: `${item.quantity} × ${item.name}${item.details ? `\n${item.details}` : ""}`, value: item.total })) },
      { type: "button", label: "Open in dashboard", href: adminUrl },
    ]),
  };
}

export function orderStatusEmail(storeName: string, data: { number: string; customerName: string; statusLabel: string; message?: string; orderUrl: string }) {
  return {
    subject: `Order ${data.number}: ${data.statusLabel}`,
    ...render(storeName, `Your order is ${data.statusLabel.toLowerCase()}`, [
      { type: "p", text: `Hi ${data.customerName}, here's an update on order ${data.number}.` },
      ...(data.message ? [{ type: "p" as const, text: data.message }] : []),
      { type: "button", label: "View your order", href: data.orderUrl },
    ]),
  };
}

export function paymentVerifiedEmail(storeName: string, data: { number: string; customerName: string; amount: string; orderUrl: string }) {
  return {
    subject: `Payment confirmed for order ${data.number}`,
    ...render(storeName, "Payment confirmed", [
      { type: "p", text: `Hi ${data.customerName}, we've confirmed your payment of ${data.amount} for order ${data.number}.` },
      { type: "button", label: "View your order", href: data.orderUrl },
    ]),
  };
}

export function paymentRejectedEmail(storeName: string, data: { number: string; customerName: string; reason?: string; orderUrl: string }) {
  return {
    subject: `We couldn't confirm your payment for order ${data.number}`,
    ...render(storeName, "We couldn't confirm your payment", [
      { type: "p", text: `Hi ${data.customerName}, we weren't able to match a payment to order ${data.number} yet.` },
      ...(data.reason ? [{ type: "p" as const, text: data.reason }] : []),
      { type: "p", text: "Please check the payment details on your order page and submit the transaction reference again, or reply to this email." },
      { type: "button", label: "View your order", href: data.orderUrl },
    ]),
  };
}

export function customRequestReceivedEmail(storeName: string, data: { number: string; name: string }) {
  return {
    subject: `We received your custom request ${data.number}`,
    ...render(storeName, "Your custom request is in", [
      { type: "p", text: `Thank you, ${data.name}. We've received your custom request ${data.number} and will reply with questions or a quote.` },
      { type: "note", text: "This is a request, not an order — nothing has been charged. We'll confirm the price and timing with you before starting." },
    ]),
  };
}

export function customRequestQuotedEmail(storeName: string, data: { number: string; name: string; amount: string; note?: string; url: string }) {
  return {
    subject: `Your quote for custom request ${data.number}`,
    ...render(storeName, "Your quote is ready", [
      { type: "p", text: `Hi ${data.name}, here is our quote for custom request ${data.number}: ${data.amount}.` },
      ...(data.note ? [{ type: "p" as const, text: data.note }] : []),
      { type: "p", text: "Reply to this email or contact us to confirm and arrange payment." },
      { type: "button", label: "View request", href: data.url },
    ]),
  };
}

export function adminNotificationEmail(storeName: string, heading: string, rows: { label: string; value: string }[], adminUrl: string) {
  return {
    subject: `${heading} — ${storeName}`,
    ...render(storeName, heading, [
      { type: "rows", rows },
      { type: "button", label: "Open in dashboard", href: adminUrl },
    ]),
  };
}

export function newsletterConfirmEmail(storeName: string, token: string) {
  const link = absoluteUrl(`/newsletter/confirm?token=${encodeURIComponent(token)}`);
  return {
    subject: `Confirm your subscription to ${storeName}`,
    ...render(storeName, "Confirm your subscription", [
      { type: "p", text: "Please confirm you'd like to receive emails from us." },
      { type: "button", label: "Confirm subscription", href: link },
      { type: "note", text: "If you didn't sign up, ignore this email and you won't be subscribed." },
    ]),
  };
}
