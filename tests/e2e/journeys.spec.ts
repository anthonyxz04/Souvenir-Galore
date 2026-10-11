import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { E2E } from "./data";
import { addProductToCart, humanPause, signIn } from "./helpers";

/**
 * The owner's acceptance checklist, run against the real app and database:
 * navigation, cart, discounts, wishlist, custom requests, contact links,
 * the admin product lifecycle, order management, persistence and privacy.
 */

async function register(page: Page, user: { name: string; email: string; password: string }) {
  await page.goto("/register");
  await page.getByLabel("Full name").fill(user.name);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await humanPause(page);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/account/);
}

test.describe("navigation", () => {
  test("hero, category and product links open the real pages", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Shop the collection" }).click();
    await expect(page).toHaveURL(/\/shop/);
    await expect(page.getByRole("link", { name: E2E.product.name }).first()).toBeVisible();

    await page.getByRole("link", { name: E2E.product.name }).first().click();
    await expect(page).toHaveURL(new RegExp(`/products/${E2E.product.slug}`));
    await expect(page.getByRole("heading", { level: 1, name: E2E.product.name })).toBeVisible();

    await page.goto("/category/concrete-candle-jars");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Concrete candle jars/i);
    await expect(page.getByRole("link", { name: E2E.product.name }).first()).toBeVisible();
  });

  test("every footer and main-menu link opens a page", async ({ page, request }) => {
    await page.goto("/");
    const hrefs = await page
      .locator('footer a[href^="/"], nav[aria-label="Main"] a[href^="/"]')
      .evaluateAll((links) => [...new Set(links.map((a) => a.getAttribute("href")!))]);
    expect(hrefs.length).toBeGreaterThan(5);
    for (const href of hrefs) {
      const response = await request.get(href);
      expect(response.status(), `${href} should open`).toBeLessThan(400);
    }
  });
});

test.describe("cart", () => {
  test("add, change quantity, remove, with correct totals", async ({ page }) => {
    await page.context().clearCookies();
    await addProductToCart(page, E2E.product.slug);
    await page.goto("/cart");
    const summary = page.getByRole("complementary", { name: "Order summary" });
    await expect(summary.getByText("$18.00").first()).toBeVisible();

    await page.getByLabel(`Quantity for ${E2E.product.name}`).selectOption("3");
    await expect(summary.getByText("$54.00").first()).toBeVisible();
    await page.reload();
    await expect(page.getByLabel(`Quantity for ${E2E.product.name}`)).toHaveValue("3");

    await page.getByRole("button", { name: `Remove ${E2E.product.name}` }).click();
    await expect(page.getByText("Your cart is empty")).toBeVisible();
  });

  test("discount codes are checked against the database", async ({ page }) => {
    await page.context().clearCookies();
    await addProductToCart(page, E2E.product.slug);
    await page.goto("/cart");

    await page.getByLabel("Discount code").fill("NOT-A-CODE");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText("This code isn't valid.")).toBeVisible();

    await page.getByLabel("Discount code").fill(E2E.discountCode);
    await page.getByRole("button", { name: "Apply" }).click();
    const summary = page.getByRole("complementary", { name: "Order summary" });
    await expect(summary.getByText("10% off")).toBeVisible();
    await expect(summary.getByText("−$1.80")).toBeVisible();
    await expect(summary.getByText("$16.20")).toBeVisible();
  });
});

test.describe.serial("customer features", () => {
  const shopper = { name: "Rana Khoury", email: `shopper-${Date.now()}@e2e.test`, password: "e2e-shopper-passphrase" };
  const other = { name: "Karim Nassar", email: `other-${Date.now()}@e2e.test`, password: "e2e-other-passphrase" };
  let shopperOrder = "";

  test("wishlist: save and remove a product", async ({ page }) => {
    await register(page, shopper);
    await page.goto(`/products/${E2E.product.slug}`);
    await page.getByRole("button", { name: "Save to wishlist" }).click();
    await expect(page.getByRole("button", { name: "Saved to wishlist" })).toBeVisible();

    await page.goto("/account/wishlist");
    await expect(page.getByRole("link", { name: E2E.product.name }).first()).toBeVisible();
    await page.getByRole("button", { name: `Remove ${E2E.product.name}` }).click();
    await expect(page.getByText("Nothing saved yet")).toBeVisible();
  });

  test("an order shows in the customer's history with its status", async ({ page }) => {
    await signIn(page, shopper.email, shopper.password);
    await addProductToCart(page, E2E.product.slug);
    await page.goto("/checkout");
    await page.getByLabel("Phone", { exact: true }).fill("+961 76 222 333");
    await page.getByRole("radio", { name: /Pickup/ }).check();
    // Choose explicitly: once more than one method is on, none is preselected.
    await page.getByRole("radio", { name: /Cash on delivery/ }).check();
    await page.getByLabel(/I agree to the/).check();
    await page.getByRole("button", { name: /Place order/ }).click();
    await expect(page).toHaveURL(/\/order\/SG-\d+/);
    shopperOrder = page.url().match(/SG-\d+/)![0];

    await page.goto("/account/orders");
    await expect(page.getByRole("link", { name: shopperOrder })).toBeVisible();
    await page.getByRole("link", { name: shopperOrder }).click();
    await expect(page.getByText("Pending").first()).toBeVisible();
  });

  test("another customer can't open that order", async ({ page }) => {
    await register(page, other);
    const response = await page.goto(`/account/orders/${shopperOrder}`);
    expect(response?.status()).toBe(404);
    const guestView = await page.goto(`/order/${shopperOrder}`);
    expect(guestView?.status()).toBe(404);
  });

  test("the admin moves the order on and the customer sees the new status", async ({ page }) => {
    await signIn(page, E2E.owner.email, E2E.owner.password, "/admin/orders");
    await page.getByRole("link", { name: shopperOrder }).click();
    await page.getByLabel("Move to").selectOption({ label: "Confirmed" });
    await page.getByRole("button", { name: "Update status" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Order marked as confirmed." })).toBeVisible();

    await page.context().clearCookies();
    await signIn(page, shopper.email, shopper.password);
    await page.goto(`/account/orders/${shopperOrder}`);
    await expect(page.getByText("Confirmed").first()).toBeVisible();
  });
});

test("custom-order requests are saved and reach the dashboard", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/custom-order");
  await page.getByLabel("Piece or product type").fill("Baptism favor candles");
  await page.getByLabel("Tell us more").fill("Forty small candles with the name Yara and the date, in ivory.");
  await page.getByLabel("Full name").fill("Maya Request");
  await page.getByLabel("Email").fill(`request-${Date.now()}@e2e.test`);
  await humanPause(page);
  await page.getByRole("button", { name: "Send request" }).click();
  const confirmation = page.getByRole("status").filter({ hasText: /was sent/i });
  await expect(confirmation).toContainText(/your request CR-?\S+ was sent/i);
  await expect(confirmation).toContainText("This isn't an order yet");

  await signIn(page, E2E.owner.email, E2E.owner.password, "/admin/custom-requests");
  await expect(page.getByText("Maya Request").first()).toBeVisible();
});

test.describe.serial("admin manages the store", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, E2E.owner.email, E2E.owner.password, "/admin");
    await expect(page).toHaveURL(/\/admin/);
  });

  test("add a candle with a photo, publish it, edit it, and it persists in the shop", async ({ page }) => {
    await page.goto("/admin/products/new");
    await page.getByLabel("Product name").fill("E2E Fig Candle");
    await page.locator('input[type="file"]').first().setInputFiles(path.join(__dirname, "../fixtures/product.jpg"));
    await expect(page.getByText("Main", { exact: true })).toBeVisible({ timeout: 30_000 });
    await page.getByLabel("Price", { exact: true }).fill("24.00");
    await page.getByLabel("Starting stock").fill("6");
    await page.getByLabel("Status").selectOption("ACTIVE");
    await page.getByRole("button", { name: "Create product" }).click();
    await expect(page).toHaveURL(/\/admin\/products\/.+\?created=1/);
    const editUrl = page.url().split("?")[0];

    await page.goto("/shop");
    await expect(page.getByRole("link", { name: "E2E Fig Candle" }).first()).toBeVisible();
    await page.goto("/products/e2e-fig-candle");
    await expect(page.locator("img").first()).toBeVisible();
    await expect(page.getByText("$24.00").first()).toBeVisible();

    await page.goto(editUrl);
    await page.getByLabel("Price", { exact: true }).fill("19.50");
    await page.getByRole("button", { name: "Save product" }).click();
    await expect(page.getByRole("status").filter({ hasText: /saved/i }).first()).toBeVisible();
    await page.goto("/products/e2e-fig-candle");
    await page.reload();
    await expect(page.getByText("$19.50").first()).toBeVisible();
  });

  test("delete a product that was never ordered", async ({ page }) => {
    await page.goto("/admin/products?q=E2E Fig Candle");
    await page.getByRole("link", { name: "E2E Fig Candle" }).first().click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete product" }).click();
    await expect(page).toHaveURL(/\/admin\/products$/);
    const response = await page.goto("/products/e2e-fig-candle");
    expect(response?.status()).toBe(404);
  });

  test("contact details from settings drive the product-page buttons", async ({ page }) => {
    await page.goto("/admin/settings?tab=contact");
    await page.getByRole("textbox", { name: "Email" }).fill("hello@e2e.test");
    await page.getByLabel("WhatsApp number").fill("96170000000");
    await page.getByLabel("Instagram username").fill("e2e.workshop");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Settings saved." })).toBeVisible();

    await page.goto(`/products/${E2E.product.slug}`);
    const main = page.getByRole("main");
    await expect(main.getByRole("link", { name: "WhatsApp", exact: true })).toHaveAttribute("href", /^https:\/\/wa\.me\/96170000000\?text=/);
    await expect(main.getByRole("link", { name: "Instagram", exact: true })).toHaveAttribute("href", "https://ig.me/m/e2e.workshop");
    await expect(main.getByRole("link", { name: "Email", exact: true })).toHaveAttribute("href", /^mailto:hello@e2e\.test\?subject=/);

    // Put the settings back so later tests see the default (no contact details).
    await page.goto("/admin/settings?tab=contact");
    await page.getByRole("textbox", { name: "Email" }).fill("");
    await page.getByLabel("WhatsApp number").fill("");
    await page.getByLabel("Instagram username").fill("");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Settings saved." })).toBeVisible();
  });
});
