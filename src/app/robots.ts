import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/account", "/cart", "/checkout", "/order/", "/api/", "/search", "/login", "/register", "/reset-password", "/verify-email", "/newsletter/"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
