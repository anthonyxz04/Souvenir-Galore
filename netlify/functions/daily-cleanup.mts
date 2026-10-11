/**
 * Netlify Scheduled Function: once a day, asks the site to run its routine
 * housekeeping (expired sessions, abandoned guest carts, unused images).
 * The work itself happens in /api/cron/cleanup, protected by CRON_SECRET.
 * Without CRON_SECRET set in the environment variables this does nothing.
 */
export default async function dailyCleanup(): Promise<Response> {
  const site = process.env.URL;
  const secret = process.env.CRON_SECRET;
  if (!site || !secret) return new Response("CRON_SECRET not set; skipped", { status: 200 });
  const response = await fetch(`${site}/api/cron/cleanup`, { headers: { authorization: `Bearer ${secret}` } });
  return new Response(`cleanup responded ${response.status}`, { status: 200 });
}

export const config = { schedule: "@daily" };
