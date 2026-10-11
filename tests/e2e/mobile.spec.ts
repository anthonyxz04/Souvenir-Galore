import { expect, test } from "@playwright/test";
import { E2E } from "./data";

test.describe("mobile", () => {
  test("menu opens and navigates", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    const menu = page.getByRole("dialog", { name: "Menu" });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("link", { name: /Souvenir Galore home/ })).toBeVisible();
    await menu.getByRole("link", { name: "Shop all" }).click();
    await expect(page).toHaveURL(/\/shop/);
  });

  test("no horizontal scrolling on key pages", async ({ page }) => {
    for (const path of ["/", "/shop", `/products/${E2E.product.slug}`, "/cart", "/custom-order", "/login"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${path} scrolls sideways`).toBeLessThanOrEqual(1);
    }
  });

  test("filters open in a sheet on the shop page", async ({ page }) => {
    await page.goto("/shop");
    await page.getByRole("button", { name: /Filters/ }).click();
    await expect(page.getByRole("dialog", { name: "Filters" })).toBeVisible();
  });

  test("touch targets on the product page are large enough", async ({ page }) => {
    await page.goto(`/products/${E2E.product.slug}`);
    const box = await page.getByRole("button", { name: "Add to cart" }).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  });
});
