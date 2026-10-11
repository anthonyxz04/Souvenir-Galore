/**
 * Outgoing email over SMTP (works with any provider). When SMTP is not
 * configured, development prints emails to the console so links can be
 * followed; production logs a warning and skips sending.
 */

import { env } from "../env";

export type EmailMessage = {
  to: string | string[];
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
};

type Transport = { sendMail(message: Record<string, unknown>): Promise<unknown> };
let transportPromise: Promise<Transport | null> | null = null;

async function getTransport(): Promise<Transport | null> {
  if (!process.env.SMTP_HOST) return null;
  transportPromise ??= import("nodemailer").then((nodemailer) =>
    nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    }),
  );
  return transportPromise;
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.EMAIL_FROM);
}

/** Sends an email. Never throws — failures are logged so they can't break checkout. */
export async function sendEmail(message: EmailMessage): Promise<boolean> {
  const recipients = Array.isArray(message.to) ? message.to : [message.to];
  if (recipients.length === 0) return false;

  try {
    const transport = await getTransport();
    if (!transport || !process.env.EMAIL_FROM) {
      if (env.isProduction) {
        console.warn(`[email] SMTP is not configured — skipped "${message.subject}".`);
      } else {
        console.info(`\n[email:dev] To: ${recipients.join(", ")}\nSubject: ${message.subject}\n\n${message.text}\n`);
      }
      return false;
    }
    await transport.sendMail({
      from: process.env.EMAIL_FROM,
      to: recipients.join(", "),
      subject: message.subject,
      text: message.text,
      html: message.html,
      replyTo: message.replyTo,
    });
    return true;
  } catch (error) {
    console.error(`[email] failed to send "${message.subject}":`, error instanceof Error ? error.message : error);
    return false;
  }
}
