import { expect, type Page } from "@playwright/test";

/** Public forms reject submissions made faster than a person could type. */
export async function humanPause(page: Page) {
  await page.waitForTimeout(2700);
}

export async function signIn(page: Page, email: string, password: string, next = "") {
  await page.goto(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

export async function addProductToCart(page: Page, slug: string, name?: string) {
  await page.goto(`/products/${slug}`);
  if (name) await page.getByLabel(/^Name/).fill(name);
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Added to your cart" })).toBeVisible();
}
