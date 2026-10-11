import { NextResponse } from "next/server";
import { getProductCardsByIds } from "@/lib/catalog/queries";

/** Product cards for "Recently viewed" (ids come from the visitor's own browser). */
export async function GET(request: Request) {
  const ids = (new URL(request.url).searchParams.get("ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => /^[a-z0-9]{10,40}$/i.test(id))
    .slice(0, 12);
  const products = await getProductCardsByIds(ids);
  return NextResponse.json({ products }, { headers: { "Cache-Control": "private, max-age=60" } });
}
