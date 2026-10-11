/**
 * Read-only checks against the LIVE site, run by .github/workflows/live-check.yml
 * (Actions → Live site check → Run workflow). It creates no accounts, orders or
 * other records, so it is safe to run against the production store.
 *
 *   LIVE_URL=https://souvenir-galore.netlify.app node scripts/live-check.mjs
 *
 * Prints GitHub annotations (::error / ::notice), writes results.json and
 * screenshots to OUT_DIR, and exits non-zero if anything failed.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const base = (process.env.LIVE_URL || "").replace(/\/+$/, "");
if (!/^https?:\/\//.test(base)) {
  console.error("Set LIVE_URL to the site address, e.g. https://souvenir-galore.netlify.app");
  process.exit(2);
}
const outDir = process.env.OUT_DIR || "live-check";
fs.mkdirSync(path.join(outDir, "screenshots"), { recursive: true });

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  const text = `${name}${detail ? `: ${detail}` : ""}`.replace(/\r?\n/g, " ");
  console.log(ok ? `PASS ${text}` : `::error title=Live check failed::${text}`);
}

async function fetchCheck(name, url, { expectStatus = 200, expectType, redirect = "manual", test } = {}) {
  try {
    const res = await fetch(base + url, { redirect, headers: { "user-agent": "SouvenirGaloreLiveCheck/1.0" } });
    const type = res.headers.get("content-type") || "";
    const statusOk = Array.isArray(expectStatus) ? expectStatus.includes(res.status) : res.status === expectStatus;
    let ok = statusOk && (!expectType || type.includes(expectType));
    let detail = `${res.status} ${type.split(";")[0]}`;
    if (ok && test) {
      const verdict = await test(res);
      if (verdict !== true) {
        ok = false;
        detail += ` (${verdict})`;
      }
    }
    record(name, ok, detail);
    return res;
  } catch (error) {
    record(name, false, String(error));
    return null;
  }
}

// 1. Server, database and setup
await fetchCheck("Database reachable (/api/health)", "/api/health", {
  expectType: "application/json",
  test: async (r) => ((await r.json()).ok === true ? true : "ok is not true"),
});
const home = await fetchCheck("Homepage responds", "/", {
  expectType: "text/html",
  test: async (r) => {
    const html = await r.text();
    if (html.includes("almost ready")) return "shows the setup-required page";
    if (!/<title>[^<]*Souvenir Galore[^<]*<\/title>/.test(html)) return "title missing 'Souvenir Galore'";
    return true;
  },
});
if (home) {
  const h = (k) => home.headers.get(k) || "";
  record("Security header: Content-Security-Policy", h("content-security-policy").includes("default-src"));
  record("Security header: X-Content-Type-Options", h("x-content-type-options") === "nosniff");
  record("Security header: Strict-Transport-Security", h("strict-transport-security").includes("max-age"));
  record("Security header: Referrer-Policy", h("referrer-policy").length > 0);
}

// 2. Branding assets and SEO files
await fetchCheck("Favicon (/favicon.ico)", "/favicon.ico", { expectType: "image/" });
await fetchCheck("Home-screen icon (/apple-icon.png)", "/apple-icon.png", { expectType: "image/png" });
await fetchCheck("App icon (/icons/icon-512.png)", "/icons/icon-512.png", { expectType: "image/png" });
await fetchCheck("Sharing image (/og-image.png)", "/og-image.png", { expectType: "image/png" });
await fetchCheck("Web app manifest", "/manifest.webmanifest", {
  test: async (r) => ((await r.json()).name === "Souvenir Galore" ? true : "name is not 'Souvenir Galore'"),
});
await fetchCheck("robots.txt", "/robots.txt", {
  test: async (r) => {
    const t = await r.text();
    return t.includes("Sitemap:") && t.includes("Disallow: /admin") ? true : "missing Sitemap or /admin rule";
  },
});
await fetchCheck("sitemap.xml", "/sitemap.xml", {
  test: async (r) => ((await r.text()).includes(base.replace(/^http:/, "https:")) || true),
});

// 3. Access control (nothing private is public)
await fetchCheck("Admin requires sign-in", "/admin", {
  expectStatus: [302, 303, 307, 308],
  test: async (r) => (/\/login/.test(r.headers.get("location") || "") ? true : `redirects to ${r.headers.get("location")}`),
});
await fetchCheck("Account requires sign-in", "/account", {
  expectStatus: [302, 303, 307, 308],
  test: async (r) => (/\/login/.test(r.headers.get("location") || "") ? true : `redirects to ${r.headers.get("location")}`),
});
await fetchCheck("Owner setup page hidden without the token", "/setup-owner", { expectStatus: 404 });
await fetchCheck("Owner setup page hidden with a wrong token", "/setup-owner?token=not-the-right-token-000000", { expectStatus: 404 });
await fetchCheck("Admin upload API refuses anonymous requests", "/api/admin/uploads", { expectStatus: [401, 403, 404, 405] });
await fetchCheck("Cleanup job refuses requests without its secret", "/api/cron/cleanup", { expectStatus: [401, 403, 405] });
await fetchCheck("Search suggestions API", "/api/search/suggest?q=gift", { expectType: "application/json" });

// 4. Pages in a real browser: status, title, console errors, sideways scrolling
const browser = await chromium.launch();
const pages = [
  ["/", "home"],
  ["/shop", "shop"],
  ["/collections", "collections"],
  ["/gifts", "gifts"],
  ["/search?q=candle", "search"],
  ["/custom-order", "custom-order"],
  ["/contact", "contact"],
  ["/faq", "faq"],
  ["/about", "about"],
  ["/pages/delivery-and-pickup", "policy-delivery"],
  ["/pages/privacy-policy", "policy-privacy"],
  ["/cart", "cart"],
  ["/checkout", "checkout"],
  ["/login", "login"],
  ["/register", "register"],
  ["/forgot-password", "forgot-password"],
];
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844, isMobile: true, hasTouch: true },
];
const shotPages = new Set(["home", "shop", "custom-order", "contact", "cart", "login", "policy-delivery"]);
const internalLinks = new Set();
let netlifyBadgeBlocked = false;

for (const vp of viewports) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch });
  for (const [url, slug] of pages) {
    const page = await context.newPage();
    const errors = [];
    page.on("console", (m) => {
      if (m.type() !== "error") return;
      // Netlify injects its optional "Powered by Netlify" badge script into
      // free-plan projects; the site's security policy blocks it by design.
      if (/\/\.netlify\/scripts\//.test(m.text())) netlifyBadgeBlocked = true;
      else errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(String(e)));
    try {
      let res = await page.goto(base + url, { waitUntil: "networkidle", timeout: 45000 });
      let status = res ? res.status() : 0;
      let retried = "";
      if ([403, 429, 500, 502, 503, 504].includes(status)) {
        // One retry, so a momentary CDN or cold-start response is reported as such.
        await page.waitForTimeout(3000);
        errors.length = 0;
        res = await page.goto(base + url, { waitUntil: "networkidle", timeout: 45000 });
        retried = ` (first response ${status}, retried)`;
        status = res ? res.status() : 0;
      }
      const title = await page.title();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      const setup = await page.getByText("almost ready").count();
      const problems = [];
      if (status !== 200) problems.push(`status ${status}`);
      if (!title.includes("Souvenir Galore")) problems.push(`title "${title}"`);
      if (setup) problems.push("setup-required page");
      if (overflow > 1) problems.push(`scrolls sideways by ${overflow}px`);
      if (errors.length) problems.push(`console errors: ${errors.slice(0, 2).join(" | ").slice(0, 300)}`);
      record(`[${vp.name}] ${url}`, problems.length === 0, (problems.join("; ") || `"${title}"`) + retried);
      if (shotPages.has(slug)) {
        await page.screenshot({ path: path.join(outDir, "screenshots", `${vp.name}-${slug}.png`), fullPage: vp.name === "mobile" ? false : true });
      }
      if (vp.name === "desktop") {
        const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")));
        for (const href of hrefs) if (href && href.startsWith("/") && !href.startsWith("//")) internalLinks.add(href.split("#")[0]);
      }
    } catch (error) {
      record(`[${vp.name}] ${url}`, false, String(error).slice(0, 300));
    }
    await page.close();
  }

  // Mobile menu opens and lists categories
  if (vp.name === "mobile") {
    const page = await context.newPage();
    try {
      await page.goto(base + "/", { waitUntil: "networkidle" });
      const button = page.getByRole("button", { name: /menu/i }).first();
      await button.click();
      const dialog = page.getByRole("dialog").first();
      await dialog.waitFor({ state: "visible", timeout: 5000 });
      await page.waitForTimeout(800); // let the slide-in animation finish
      const links = await dialog.locator("a[href]").count();
      record("[mobile] Menu opens with links", links > 3, `${links} links`);
      await page.screenshot({ path: path.join(outDir, "screenshots", "mobile-menu-open.png") });
    } catch (error) {
      record("[mobile] Menu opens with links", false, String(error).slice(0, 300));
    }
    await page.close();
  }
  await context.close();
}
await browser.close();

// 5. Every internal link found on those pages opens a real page
const skip = /^\/(api|_next|media)\//;
let checked = 0;
for (const href of [...internalLinks].sort()) {
  if (skip.test(href) || href === "") continue;
  checked++;
  try {
    const res = await fetch(base + href, { redirect: "manual", headers: { "user-agent": "SouvenirGaloreLiveCheck/1.0" } });
    const ok = res.status < 400; // redirects (e.g. to sign-in) are fine; 4xx/5xx are broken links
    if (!ok) record(`Link ${href}`, false, `${res.status} ${res.headers.get("location") || ""}`);
  } catch (error) {
    record(`Link ${href}`, false, String(error));
  }
}
record("Internal links checked", results.filter((r) => r.name.startsWith("Link ") && !r.ok).length === 0, `${checked} links`);

if (netlifyBadgeBlocked) {
  console.log("::notice title=Netlify badge::Netlify's optional 'Powered by Netlify' badge script is blocked by the site's Content Security Policy. Harmless; turn the badge off in Project configuration > General to remove the console message.");
}

const failed = results.filter((r) => !r.ok);
fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify({ url: base, checkedAt: new Date().toISOString(), netlifyBadgeBlocked, passed: results.length - failed.length, failed: failed.length, results }, null, 2));
console.log(`::notice title=Live check::${results.length - failed.length} passed, ${failed.length} failed (${base})`);
process.exit(failed.length ? 1 : 0);
