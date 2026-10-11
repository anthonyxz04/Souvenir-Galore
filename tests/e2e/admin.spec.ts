import path from "node:path";
import { expect, test } from "@playwright/test";
import { E2E } from "./data";
import { signIn } from "./helpers";

test.describe.serial("admin dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, E2E.owner.email, E2E.owner.password, "/admin");
    await expect(page).toHaveURL(/\/admin/);
  });

  test("dashboard loads with verified-sales wording", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Hello, Store/ })).toBeVisible();
    await expect(page.getByText("Completed sales").first()).toBeVisible();
  });

  test("Whish Money can't be enabled until its details are filled in", async ({ page }) => {
    await page.goto("/admin/payments");
    await expect(page.getByText("Needs: Payment instructions for customers, Account holder name, Whish account / phone number")).toBeVisible();
    await page.getByRole("link", { name: "Whish Money", exact: true }).click();
    await page.getByLabel("Offer this method at checkout").check();
    await page.getByRole("button", { name: "Save payment method" }).click();
    await expect(page.getByRole("alert")).toContainText("can't be turned on yet");

    await page.getByLabel("Account holder name").fill("Test Owner");
    await page.getByLabel("Whish account / phone number").fill("00000000");
    await page.getByLabel("Payment instructions").fill("Send the total in USD and enter the transaction reference on your order page.");
    await page.getByLabel("Offer this method at checkout").check();
    await page.getByRole("button", { name: "Save payment method" }).click();
    await expect(page.getByRole("status")).toContainText("Customers can now choose this method");
  });

  test("create a category", async ({ page }) => {
    await page.goto("/admin/categories");
    await page.getByRole("button", { name: "Add category" }).click();
    await page.getByRole("dialog").getByLabel("Name").fill("E2E Lanterns");
    await page.getByRole("dialog").getByRole("button", { name: "Create category" }).click();
    await expect(page.getByRole("cell", { name: /E2E Lanterns/ })).toBeVisible();
  });

  test("create a product with an image and publish it", async ({ page }) => {
    await page.goto("/admin/products/new");
    await page.getByLabel("Product name").fill("E2E Uploaded Candle");
    await page.locator('input[type="file"]').first().setInputFiles(path.join(__dirname, "../fixtures/product.jpg"));
    await expect(page.getByText("Main", { exact: true })).toBeVisible({ timeout: 30_000 });
    await page.getByLabel("Price", { exact: true }).fill("21.50");
    await page.getByLabel("Starting stock").fill("4");
    await page.getByLabel("Status").selectOption("ACTIVE");
    await page.getByRole("button", { name: "Create product" }).click();
    await expect(page).toHaveURL(/\/admin\/products\/.+\?created=1/);
    await page.goto("/products/e2e-uploaded-candle");
    await expect(page.getByRole("heading", { name: "E2E Uploaded Candle" })).toBeVisible();
    await expect(page.getByText("$21.50").first()).toBeVisible();
  });

  test("record a cash payment on an order", async ({ page }) => {
    await page.goto("/admin/orders?payment=UNPAID");
    await page.getByRole("link", { name: /SG-\d+/ }).first().click();
    await page.getByRole("button", { name: "Record cash received" }).click();
    await expect(page.getByRole("status")).toContainText("marked as paid");
    await expect(page.getByText("Paid", { exact: true }).first()).toBeVisible();
  });

  test("uploads from other sites are rejected", async ({ request }) => {
    const response = await request.post("/api/admin/uploads", { headers: { origin: "https://evil.example" }, multipart: { purpose: "products" } });
    expect(response.status()).toBe(403);
  });
});
