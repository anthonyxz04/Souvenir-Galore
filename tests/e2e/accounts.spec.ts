import { expect, test } from "@playwright/test";
import { E2E } from "./data";
import { humanPause, signIn } from "./helpers";

test.describe.serial("customer accounts", () => {
  test("register, see the account, and sign out", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Full name").fill(E2E.customer.name);
    await page.getByLabel("Email").fill(E2E.customer.email);
    await page.getByLabel("Password", { exact: true }).fill(E2E.customer.password);
    await humanPause(page);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/account/);
    await expect(page.getByRole("heading", { name: /Welcome, Nour/ })).toBeVisible();
    await expect(page.getByText("Please confirm your email")).toBeVisible();
    await page.getByRole("navigation", { name: "Account" }).getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL("/");
  });

  test("wrong password shows a generic error", async ({ page }) => {
    await signIn(page, E2E.customer.email, "not-the-right-password");
    await expect(page.getByRole("alert")).toContainText("The email or password is incorrect.");
  });

  test("password reset never reveals whether an account exists", async ({ page }) => {
    for (const email of [E2E.customer.email, "nobody@e2e.test"]) {
      await page.goto("/forgot-password");
      await page.getByLabel("Email").fill(email);
      await page.getByRole("button", { name: "Send reset link" }).click();
      await expect(page.getByRole("status")).toContainText("If an account exists for that email");
    }
  });

  test("signed-in customers check out with saved details and see order history", async ({ page }) => {
    await signIn(page, E2E.customer.email, E2E.customer.password);
    await page.goto(`/products/${E2E.product.slug}`);
    await page.getByRole("button", { name: "Add to cart" }).click();
    await page.goto("/checkout");
    await page.getByLabel("Phone", { exact: true }).fill("+961 71 000 111");
    await page.getByRole("radio", { name: /Pickup/ }).check();
    await page.getByLabel(/I agree to the/).check();
    await page.getByRole("button", { name: /Place order/ }).click();
    await expect(page).toHaveURL(/\/order\/SG-/);
    await page.goto("/account/orders");
    await expect(page.getByRole("link", { name: /SG-\d+/ }).first()).toBeVisible();
  });

  test("customers can't open the admin dashboard", async ({ page }) => {
    await signIn(page, E2E.customer.email, E2E.customer.password);
    const response = await page.goto("/admin");
    expect(response?.status()).toBe(404);
    const api = await page.request.get("/api/admin/orders/export");
    expect(api.status()).toBe(404);
  });

  test("signed-out visitors are sent to sign in for account pages", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/account/orders");
    await expect(page).toHaveURL(/\/login\?next=%2Faccount%2Forders/);
  });
});
