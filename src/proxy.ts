import { NextResponse, type NextRequest } from "next/server";

/**
 * Runs before every page request (Next.js 16 "proxy", formerly middleware):
 *  - Generates a per-request nonce and a strict Content-Security-Policy.
 *    Next.js automatically adds the nonce to its own scripts.
 *  - Sends signed-out visitors of /account and /admin to the login page early.
 *    (Real authorization is enforced again on the server for every request.)
 *  - Keeps the session cookie's browser expiry in step with the sliding
 *    server-side session.
 */

// The server names the session cookie from the site address (src/lib/auth/session.ts):
// "__Host-sg_session" on https, "sg_session" otherwise. Accept both here so this
// code (which may run at the edge with a different environment) never disagrees.
const SESSION_COOKIES = ["__Host-sg_session", "sg_session"] as const;

function origin(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function buildCsp(nonce: string, httpsRequest: boolean): string {
  const isDev = process.env.NODE_ENV !== "production";
  const scriptSrc = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
  if (isDev) scriptSrc.push("'unsafe-eval'");

  const imgSrc = ["'self'", "data:", "blob:"];
  const connectSrc = ["'self'"];
  const frameSrc: string[] = [];

  const mediaOrigin = origin(process.env.S3_PUBLIC_URL);
  if (mediaOrigin) imgSrc.push(mediaOrigin);

  if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
    scriptSrc.push("https://challenges.cloudflare.com");
    frameSrc.push("https://challenges.cloudflare.com");
    connectSrc.push("https://challenges.cloudflare.com");
  }
  const plausible = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN ? origin(process.env.NEXT_PUBLIC_PLAUSIBLE_SRC || "https://plausible.io/js/script.js") : null;
  if (plausible) connectSrc.push(plausible);
  if (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID) {
    connectSrc.push("https://*.google-analytics.com", "https://*.analytics.google.com", "https://www.googletagmanager.com");
    imgSrc.push("https://*.google-analytics.com", "https://www.googletagmanager.com");
  }
  if (isDev) connectSrc.push("ws:", "wss:");

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imgSrc.join(" ")}`,
    "font-src 'self'",
    `connect-src ${connectSrc.join(" ")}`,
    `frame-src ${frameSrc.length ? frameSrc.join(" ") : "'none'"}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (!isDev && httpsRequest) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

// Set at build time on Netlify when required settings were missing (next.config.ts).
const SETUP_MISSING = process.env.BUILD_SETUP_MISSING || "";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (SETUP_MISSING && pathname !== "/setup-required") {
    return NextResponse.rewrite(new URL("/setup-required", request.url));
  }
  const sessionCookie = SESSION_COOKIES.find((name) => request.cookies.has(name));
  const hasSession = Boolean(sessionCookie);

  if (!hasSession && (pathname === "/account" || pathname.startsWith("/account/") || pathname === "/admin" || pathname.startsWith("/admin/"))) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }

  const nonce = btoa(crypto.randomUUID());
  const httpsRequest = request.headers.get("x-forwarded-proto") === "https" || request.nextUrl.protocol === "https:";
  const csp = buildCsp(nonce, httpsRequest);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);

  // Admin and account pages must never be cached by shared caches.
  if (pathname.startsWith("/admin") || pathname.startsWith("/account") || pathname.startsWith("/checkout")) {
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  if (sessionCookie && request.method === "GET") {
    const token = request.cookies.get(sessionCookie)?.value;
    if (token) {
      response.cookies.set(sessionCookie, token, {
        httpOnly: true,
        secure: sessionCookie.startsWith("__Host-"),
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 86_400,
      });
    }
  }

  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|media|icons|favicon.ico|icon.svg|apple-icon.png|og-image.png|robots.txt|sitemap.xml|manifest.webmanifest).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
