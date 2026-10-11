import { describe, expect, it } from "vitest";
import { convertForDisplay, divRoundHalfUp, formatMoney, parseMoney, percentOf, toMajorString } from "@/lib/money";

describe("parseMoney", () => {
  it("parses whole and fractional amounts into minor units", () => {
    expect(parseMoney("12", 2)).toBe(1200);
    expect(parseMoney("12.5", 2)).toBe(1250);
    expect(parseMoney("12.50", 2)).toBe(1250);
    expect(parseMoney("0.01", 2)).toBe(1);
    expect(parseMoney("1,250.99", 2)).toBe(125099);
    expect(parseMoney(" 3 ", 2)).toBe(300);
  });

  it("avoids floating-point errors", () => {
    // 0.1 + 0.2 style issues: 19.99 * 100 = 1998.9999999999998 in floating point
    expect(parseMoney("19.99", 2)).toBe(1999);
    expect(parseMoney("1.15", 2)).toBe(115);
  });

  it("supports zero-decimal currencies", () => {
    expect(parseMoney("450000", 0)).toBe(450000);
    expect(parseMoney("450000.5", 0)).toBeNull();
  });

  it("rejects invalid input", () => {
    expect(parseMoney("", 2)).toBeNull();
    expect(parseMoney("-5", 2)).toBeNull();
    expect(parseMoney("abc", 2)).toBeNull();
    expect(parseMoney("1.234", 2)).toBeNull();
    expect(parseMoney("1e5", 2)).toBeNull();
    expect(parseMoney(null, 2)).toBeNull();
  });
});

describe("toMajorString", () => {
  it("formats minor units for inputs", () => {
    expect(toMajorString(1250, 2)).toBe("12.50");
    expect(toMajorString(5, 2)).toBe("0.05");
    expect(toMajorString(0, 2)).toBe("0.00");
    expect(toMajorString(450000, 0)).toBe("450000");
    expect(toMajorString(null, 2)).toBe("");
  });

  it("round-trips with parseMoney", () => {
    for (const value of [0, 1, 99, 100, 12345, 999999]) {
      expect(parseMoney(toMajorString(value, 2), 2)).toBe(value);
    }
  });
});

describe("arithmetic helpers", () => {
  it("rounds half up", () => {
    expect(divRoundHalfUp(5, 2)).toBe(3);
    expect(divRoundHalfUp(4, 2)).toBe(2);
    expect(divRoundHalfUp(1, 3)).toBe(0);
    expect(divRoundHalfUp(2, 3)).toBe(1);
  });

  it("takes percentages rounding down", () => {
    expect(percentOf(999, 10)).toBe(99);
    expect(percentOf(1000, 15)).toBe(150);
  });

  it("converts for secondary display currency", () => {
    // $12.50 at 89,500 LBP per USD
    expect(convertForDisplay(1250, { code: "USD", decimals: 2, locale: "en-US" }, 89500, { code: "LBP", decimals: 0, locale: "en-US" })).toBe(1118750);
  });
});

describe("formatMoney", () => {
  it("formats in the configured currency", () => {
    expect(formatMoney(1250, { code: "USD", decimals: 2, locale: "en-US" })).toBe("$12.50");
    expect(formatMoney(0, { code: "USD", decimals: 2, locale: "en-US" })).toBe("$0.00");
  });

  it("falls back gracefully for unknown currencies", () => {
    expect(formatMoney(100, { code: "ZZZ", decimals: 2, locale: "not-a-locale" })).toContain("1.00");
  });
});
