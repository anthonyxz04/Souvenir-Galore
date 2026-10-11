import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run a production build against the TEST database.
 *   TEST_DATABASE_URL=postgresql://… npm run test:e2e
 * The global setup resets that database and creates test data.
 */
const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: process.env.CI ? "github" : "list",
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Software WebGL, so the 3D candle preview renders on CI machines without a GPU.
    launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /mobile\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${port}`,
    url: `${baseURL}/api/health`,
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
      APP_URL: baseURL,
      APP_SECRET: process.env.APP_SECRET ?? "e2e-secret-that-is-long-enough-for-hmac-123456",
      STORAGE_DRIVER: "local",
      STORAGE_LOCAL_DIR: "./storage-e2e",
      TRUST_PROXY: "false",
    },
  },
});
