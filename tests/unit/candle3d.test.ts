import { describe, expect, it } from "vitest";
import {
  completeValueLooks,
  describeLook,
  normalizePreview3d,
  parsePreview3d,
  productChoices,
  resolveLook,
  suggestBindings,
  suggestColor,
  suggestSizes,
} from "@/lib/candle3d/config";

const product = {
  options: [
    { name: "Size", values: ["Small", "Large"] },
    { name: "Jar color", values: ["Natural", "Charcoal"] },
    { name: "Scent", values: ["Fig", "Unscented"] },
  ],
  personalizationFields: [
    { label: "Name on the label", type: "TEXT", options: [] },
    { label: "Wax color", type: "SELECT", options: ["Ivory", "Blush"] },
    { label: "Lid", type: "SELECT", options: ["No lid", "Wood"] },
    { label: "Date", type: "DATE", options: [] },
  ],
};
const choices = productChoices(product);

describe("3D candle settings", () => {
  it("falls back to safe, switched-off defaults for missing or invalid settings", () => {
    expect(parsePreview3d(null).enabled).toBe(false);
    const broken = parsePreview3d({ enabled: true, shape: "teapot", jarColor: "red" });
    expect(broken.enabled).toBe(false);
    expect(broken.shape).toBe("tumbler");
    expect(broken.jarColor).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("links choices to candle parts by their names, leaving unrelated ones alone", () => {
    expect(suggestBindings(choices)).toEqual({
      jarColor: "Jar color",
      waxColor: "Wax color",
      size: "Size",
      lid: "Lid",
      font: "",
      labelText: ["Name on the label", "Date"],
    });
  });

  it("follows the customer's choices and typed text", () => {
    const config = completeValueLooks(parsePreview3d({ enabled: true, bindings: suggestBindings(choices) }), choices);
    const before = resolveLook(config, { Size: "Small", "Jar color": "Natural" }, "Concrete candle");
    expect(before.lines).toEqual(["Concrete candle"]);
    expect(before.placeholder).toBe(true);

    const look = resolveLook(config, { Size: "Large", "Jar color": "Charcoal", "Wax color": "Blush", Lid: "Wood", "Name on the label": "  Maya ", Date: "2026-06-12", Scent: "Fig" });
    expect(look.jarColor).toBe(config.jarColors.Charcoal);
    expect(look.waxColor).toBe(config.waxColors.Blush);
    expect(look.lid).toBe("wood");
    expect(look.scale).toBeGreaterThan(before.scale);
    expect(look.lines).toEqual(["Maya", "12.06.2026"]); // date fields print as day.month.year
    expect(look.placeholder).toBe(false);
    expect(describeLook(look, { jar: "Charcoal", wax: "Blush", lid: "Wood" })).toBe(
      "A candle in a charcoal straight jar with blush wax and a wood lid. The label reads “Maya / 12.06.2026”.",
    );
  });

  it("uses the fixed look for values the owner hasn't set", () => {
    const config = parsePreview3d({ enabled: true, jarColor: "#123456", bindings: { jarColor: "Jar color" } });
    expect(resolveLook(config, { "Jar color": "Unknown" }).jarColor).toBe("#123456");
  });

  it("suggests colors and relative sizes from value names", () => {
    expect(suggestColor("Charcoal grey")).toBe("#4a4845");
    expect(suggestColor("Sage")).toBe("#a8b597");
    expect(suggestColor("Something else")).toMatch(/^#[0-9a-f]{6}$/);
    expect(suggestSizes(["Small", "Medium", "Large"])).toEqual({ Small: 0.85, Medium: 1, Large: 1.16 });
    const grams = suggestSizes(["100 g", "200 g", "800 g"]);
    expect(grams["200 g"]).toBe(1);
    expect(grams["800 g"]).toBeCloseTo(1.59, 2);
    expect(grams["100 g"]).toBeLessThan(1);
  });

  it("clears links to removed choices and keeps per-value looks in step", () => {
    const config = parsePreview3d({
      enabled: true,
      bindings: { jarColor: "Jar color", waxColor: "Old option", labelText: ["Name on the label", "Scent", "Gone"] },
      jarColors: { Natural: "#000000", Retired: "#ffffff" },
    });
    const normalized = normalizePreview3d(config, choices);
    expect(normalized.bindings.waxColor).toBe("");
    expect(normalized.bindings.labelText).toEqual(["Name on the label"]);
    expect(normalized.jarColors.Natural).toBe("#000000");
    expect(normalized.jarColors.Charcoal).toBe("#4a4845");
    expect(normalized.jarColors.Retired).toBeUndefined();
  });
});
