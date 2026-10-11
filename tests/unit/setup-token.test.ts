import { afterEach, describe, expect, it } from "vitest";
import { isValidSetupToken } from "@/lib/auth/setup-token";

const saved = process.env.SETUP_TOKEN;
afterEach(() => {
  if (saved === undefined) delete process.env.SETUP_TOKEN;
  else process.env.SETUP_TOKEN = saved;
});

describe("owner setup link", () => {
  it("is disabled when no SETUP_TOKEN is configured", () => {
    delete process.env.SETUP_TOKEN;
    expect(isValidSetupToken("anything")).toBe(false);
  });

  it("refuses short configured tokens", () => {
    process.env.SETUP_TOKEN = "too-short";
    expect(isValidSetupToken("too-short")).toBe(false);
  });

  it("accepts only the exact token", () => {
    process.env.SETUP_TOKEN = "a-long-enough-setup-token-1234567890";
    expect(isValidSetupToken("a-long-enough-setup-token-1234567890")).toBe(true);
    expect(isValidSetupToken("a-long-enough-setup-token-123456789")).toBe(false);
    expect(isValidSetupToken("")).toBe(false);
    expect(isValidSetupToken(undefined)).toBe(false);
  });
});
