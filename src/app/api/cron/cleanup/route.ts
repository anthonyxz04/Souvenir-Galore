import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runCleanup } from "@/lib/maintenance";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily housekeeping for hosts with HTTP cron (Vercel Cron: see vercel.json).
 * Requires `Authorization: Bearer <CRON_SECRET>`; Vercel sends this header
 * automatically when the CRON_SECRET environment variable is set. Without
 * CRON_SECRET configured the endpoint does not exist.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < 16) return new NextResponse(null, { status: 404 });
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const result = await runCleanup();
  return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
}
