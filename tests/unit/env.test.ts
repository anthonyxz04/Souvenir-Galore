import { afterEach, describe, expect, it } from "vitest";
import { env } from "@/lib/env";

const saved = { APP_URL: process.env.APP_URL, URL: process.env.URL };

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("site address", () => {
  it("prefers APP_URL and strips trailing slashes", () => {
    process.env.APP_URL = "https://shop.example.com/";
    process.env.URL = "https://souvenir-galore.netlify.app";
    expect(env.appUrl).toBe("https://shop.example.com");
    expect(env.secureCookies).toBe(true);
  });

  it("falls back to the address Netlify provides", () => {
    delete process.env.APP_URL;
    process.env.URL = "https://souvenir-galore.netlify.app";
    expect(env.appUrl).toBe("https://souvenir-galore.netlify.app");
    expect(env.secureCookies).toBe(true);
  });

  it("uses plain cookies for a local http address", () => {
    process.env.APP_URL = "http://localhost:3000";
    expect(env.secureCookies).toBe(false);
  });
});
