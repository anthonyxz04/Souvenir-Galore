import { expect, test } from "@playwright/test";
import { E2E } from "./data";
import { signIn } from "./helpers";

/**
 * The 3D candle customizer: the owner turns it on in the product editor, and
 * a customer's choices and text show on the candle and go into the cart.
 */
test.describe.serial("3D candle customizer", () => {
  test("the owner sets up a 3D preview for a candle", async ({ page }) => {
    await signIn(page, E2E.owner.email, E2E.owner.password, "/admin/products/new");
    await page.getByLabel("Product name").fill("E2E 3D Candle");
    await page.getByRole("button", { name: "Add an option" }).click();
    await page.getByLabel("Option name").fill("Jar color");
    await page.getByLabel("Values, separated by commas").fill("Natural, Charcoal");
    const prices = page.getByLabel("Price", { exact: true });
    await expect(prices).toHaveCount(2);
    for (const i of [0, 1]) {
      await prices.nth(i).fill("20.00");
      await page.getByLabel("Starting stock").nth(i).fill("5");
    }
    await page.getByRole("button", { name: "Add field" }).click();
    await page.getByLabel("Label", { exact: true }).fill("Name on the candle");
    await page.getByLabel("Required").uncheck();

    await page.getByLabel("Show a 3D preview on the product page").check();
    await page.getByRole("button", { name: "Link my options automatically" }).click();
    await expect(page.getByLabel("Jar color changes with")).toHaveValue("Jar color");
    await expect(page.getByRole("checkbox", { name: "Name on the candle" })).toBeChecked();
    await page.getByLabel("Jar color for Charcoal").fill("#3a3936");
    // The live preview in the editor draws the candle.
    await expect(page.getByRole("img", { name: /3D preview/ })).toHaveAttribute("data-candle-preview", "ready", { timeout: 30_000 });

    await page.getByLabel("Status").selectOption("ACTIVE");
    await page.getByRole("button", { name: "Create product" }).click();
    await expect(page).toHaveURL(/\/admin\/products\/.+\?created=1/);
    // Saved settings come back when the product is opened again.
    await page.reload();
    await expect(page.getByLabel("Show a 3D preview on the product page")).toBeChecked();
    await expect(page.getByLabel("Jar color for Charcoal")).toHaveValue("#3a3936");
  });

  test("a customer's choices and name show on the candle and go into the cart", async ({ page }) => {
    await page.goto("/products/e2e-3d-candle");
    const preview = page.getByRole("img", { name: /3D preview/ });
    await expect(preview).toHaveAttribute("data-candle-preview", "ready", { timeout: 30_000 });
    await expect(preview).toHaveAttribute("aria-label", /natural/i);

    await page.locator("label", { hasText: /^Charcoal$/ }).click();
    await expect(preview).toHaveAttribute("aria-label", /charcoal/i);
    await page.getByLabel(/^Name on the candle/).fill("Maya");
    await expect(preview).toHaveAttribute("aria-label", /The label reads “Maya”/);

    // Turning the candle with the mouse doesn't break anything.
    const box = await preview.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2, { steps: 8 });
      await page.mouse.up();
    }
    await page.getByRole("button", { name: "Reset view" }).click();

    await page.getByRole("button", { name: "Add to cart" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Added to your cart" })).toBeVisible();
    await page.goto("/cart");
    await expect(page.getByText("Maya").first()).toBeVisible();
    await expect(page.getByText(/Charcoal/).first()).toBeVisible();
  });

  test("products without a 3D preview keep the normal photo gallery", async ({ page }) => {
    await page.goto(`/products/${E2E.product.slug}`);
    await expect(page.getByRole("img", { name: /3D preview/ })).toHaveCount(0);
  });
});
