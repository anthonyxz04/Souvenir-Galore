import { NextResponse } from "next/server";
import { hashIp } from "@/lib/auth/crypto";
import { searchSuggestions } from "@/lib/catalog/queries";
import { formatMoney } from "@/lib/money";
import { checkLimit } from "@/lib/rate-limit";
import { getRequestMeta } from "@/lib/request";
import { getCurrency } from "@/lib/settings";
import { publicMediaBase } from "@/lib/storage";
import { mediaUrl } from "@/lib/storage/urls";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const { ip } = await getRequestMeta();
  if (!(await checkLimit("search", hashIp(ip)))) {
    return NextResponse.json({ products: [], categories: [] }, { status: 429 });
  }
  const [results, currency] = await Promise.all([searchSuggestions(q), getCurrency()]);
  const base = publicMediaBase();
  return NextResponse.json(
    {
      categories: results.categories,
      products: results.products.map((product) => ({
        slug: product.slug,
        name: product.name,
        price: product.pricingType === "QUOTE" ? "Price on request" : formatMoney(product.priceMin, currency),
        image: product.images[0] ? mediaUrl(base, product.images[0].asset, 320) : null,
      })),
    },
    { headers: { "Cache-Control": "private, max-age=30" } },
  );
}
