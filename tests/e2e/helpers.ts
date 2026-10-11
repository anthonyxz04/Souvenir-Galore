import { expect, type Page } from "@playwright/test";

/** Public forms reject submissions made faster than a person could type. */
export async function humanPause(page: Page) {
  await page.waitForTimeout(2700);
}

/**
 * Signs in and waits until the app has moved on from the login page, so the
 * next navigation can't interrupt the sign-in. Pass expectSuccess: false to
 * stay on the page (e.g. to check the error for a wrong password).
 */
export async function signIn(page: Page, email: string, password: string, next = "", { expectSuccess = true } = {}) {
  await page.goto(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  if (expectSuccess) await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
}

export async function addProductToCart(page: Page, slug: string, name?: string) {
  await page.goto(`/products/${slug}`);
  if (name) await page.getByLabel(/^Name/).fill(name);
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Added to your cart" })).toBeVisible();
}
