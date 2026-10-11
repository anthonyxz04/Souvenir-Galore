import { expect, test } from "@playwright/test";
import { E2E } from "./data";
import { addProductToCart } from "./helpers";

test.describe("storefront", () => {
  test("homepage shows the brand, hero and navigation", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Souvenir Galore/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
    await expect(page.getByLabel("Try a name")).toBeVisible();
  });

  test("the hero name tag writes the name and remembers it for personalization", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Try a name").fill("Karim");
    await expect(page.getByText("Karim", { exact: true }).first()).toBeVisible();
    await page.goto(`/products/${E2E.product.slug}`);
    await expect(page.getByLabel(/^Name/)).toHaveValue("Karim");
  });

  test("shop lists products and filters work without JavaScript errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/shop");
    await expect(page.getByRole("link", { name: E2E.product.name })).toBeVisible();
    await page.goto("/shop?max=20");
    await expect(page.getByRole("link", { name: E2E.product.name })).toBeVisible();
    await expect(page.getByRole("link", { name: E2E.limitedProduct.name })).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("search finds products", async ({ page }) => {
    await page.goto("/search?q=concrete");
    await expect(page.getByRole("link", { name: E2E.product.name })).toBeVisible();
  });

  test("product page has structured data and personalization pricing", async ({ page }) => {
    await page.goto(`/products/${E2E.product.slug}`);
    await expect(page.getByRole("heading", { level: 1, name: E2E.product.name })).toBeVisible();
    const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(jsonLd.some((text) => text.includes('"@type":"Product"'))).toBe(true);
    await page.getByLabel(/^Name/).fill("Maya");
    await expect(page.getByText("Includes $2.00 for personalization")).toBeVisible();
  });

  test("guest checkout with cash on delivery creates an order that is not paid", async ({ page }) => {
    await addProductToCart(page, E2E.product.slug, "Maya");
    await page.goto("/cart");
    await expect(page.getByText("Maya")).toBeVisible();
    await page.getByRole("link", { name: "Check out" }).click();
    await expect(page).toHaveURL(/\/checkout/);

    await page.getByLabel("Email").fill("guest@e2e.test");
    await page.getByLabel("Full name").fill("Guest Buyer");
    await page.getByLabel("Phone", { exact: true }).fill("+961 70 123 456");
    await page.getByLabel("Recipient name").fill("Guest Buyer");
    await page.getByLabel("Recipient phone").fill("70123456");
    await page.getByLabel("Street, building, floor").fill("Hamra Street, Building 5, 2nd floor");
    await page.getByLabel("Town / city").fill("Beirut");
    await page.getByLabel("Delivery area").selectOption({ label: "Beirut: $3.00, 1–2 days" });
    await page.getByLabel(/I agree to the/).check();
    await expect(page.getByRole("button", { name: /Place order — \$23\.00/ })).toBeVisible();
    await page.getByRole("button", { name: /Place order/ }).click();

    await expect(page).toHaveURL(/\/order\/SG-\d+\?token=/);
    await expect(page.getByRole("heading", { name: /Thank you, Guest/ })).toBeVisible();
    await expect(page.getByText("Unpaid")).toBeVisible();
  });

  test("an empty cart can't reach checkout", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/checkout");
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByText("Your cart is empty")).toBeVisible();
  });

  test("security headers are sent", async ({ page }) => {
    const response = await page.goto("/");
    const headers = response!.headers();
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["content-security-policy"]).toMatch(/script-src 'self' 'nonce-/);
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-powered-by"]).toBeUndefined();
  });
});

test("branding: tab title, favicon, home-screen icon and sharing image", async ({ page, request }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Souvenir Galore");
  const icons = await page.locator('link[rel="icon"]').evaluateAll((els) => els.map((el) => el.getAttribute("href") ?? ""));
  expect(icons.some((href) => href.startsWith("/favicon.ico"))).toBe(true);
  expect(icons.some((href) => href.includes("/icon.svg"))).toBe(true);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  for (const path of ["/favicon.ico", "/icon.svg", "/apple-icon.png", "/og-image.png", "/icons/icon-192.png", "/manifest.webmanifest"]) {
    const response = await request.get(path);
    expect(response.ok(), `${path} should be served`).toBe(true);
  }
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute("content", "Souvenir Galore");
  await expect(page.locator('meta[property="og:image"]').first()).toHaveAttribute("content", /og-image\.png/);
  await expect(page.getByRole("banner").getByRole("link", { name: /Souvenir Galore/ })).toBeVisible();
});
