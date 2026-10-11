import { describe, expect, it } from "vitest";
import { personalizationFingerprint, validatePersonalization, type PersonalizationFieldDef } from "@/lib/personalization";

const fields: PersonalizationFieldDef[] = [
  { id: "name", label: "Name", type: "TEXT", isRequired: true, maxLength: 20, options: [], priceDelta: 0 },
  { id: "date", label: "Date", type: "DATE", isRequired: false, maxLength: null, options: [], priceDelta: 0 },
  { id: "msg", label: "Message", type: "TEXTAREA", isRequired: false, maxLength: 50, options: [], priceDelta: 250 },
  { id: "font", label: "Font", type: "SELECT", isRequired: false, maxLength: null, options: ["Script", "Classic"], priceDelta: 0 },
];

describe("validatePersonalization", () => {
  it("accepts valid input and adds surcharges for filled paid fields", () => {
    const result = validatePersonalization(fields, { name: "  Maya  ", date: "2026-06-14", msg: "With love", font: "Script" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.values.map((v) => v.value)).toEqual(["Maya", "2026-06-14", "With love", "Script"]);
      expect(result.surcharge).toBe(250);
    }
  });

  it("requires required fields", () => {
    const result = validatePersonalization(fields, { name: "   " });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.name).toBe("Enter name.");
  });

  it("does not charge for empty optional fields", () => {
    const result = validatePersonalization(fields, { name: "Maya", msg: "" });
    expect(result.ok && result.surcharge).toBe(0);
  });

  it("enforces maximum lengths", () => {
    const result = validatePersonalization(fields, { name: "x".repeat(21) });
    expect(result.ok).toBe(false);
  });

  it("validates real calendar dates", () => {
    expect(validatePersonalization(fields, { name: "A", date: "2026-02-30" }).ok).toBe(false);
    expect(validatePersonalization(fields, { name: "A", date: "14/06/2026" }).ok).toBe(false);
  });

  it("only accepts listed options", () => {
    expect(validatePersonalization(fields, { name: "A", font: "Comic" }).ok).toBe(false);
  });

  it("strips control characters and collapses whitespace on single-line fields", () => {
    const result = validatePersonalization(fields, { name: "Ma\u0000ya\t  Kh", msg: "Line 1\nLine 2" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.values[0].value).toBe("Maya Kh");
      expect(result.values[1].value).toBe("Line 1\nLine 2");
    }
  });

  it("ignores unknown fields", () => {
    const result = validatePersonalization(fields, { name: "A", injected: "x" });
    expect(result.ok && result.values.length).toBe(1);
  });

  it("produces an order-independent fingerprint", () => {
    const a = personalizationFingerprint([
      { fieldId: "b", label: "B", value: "2", priceDelta: 0 },
      { fieldId: "a", label: "A", value: "1", priceDelta: 0 },
    ]);
    const b = personalizationFingerprint([
      { fieldId: "a", label: "A", value: "1", priceDelta: 0 },
      { fieldId: "b", label: "B", value: "2", priceDelta: 0 },
    ]);
    expect(a).toBe(b);
    expect(personalizationFingerprint([])).toBe("");
  });
});
