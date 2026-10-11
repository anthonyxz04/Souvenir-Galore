import { describe, expect, it } from "vitest";
import { parseSettings } from "@/lib/settings/schemas";
import { isValidSlug, safeHref, slugify, stripControlChars } from "@/lib/text";

describe("settings defaults", () => {
  it("provides safe defaults with no contact details invented", () => {
    const contact = parseSettings("contact", null);
    expect(contact.email).toBe("");
    expect(contact.phone).toBe("");
    expect(contact.whatsapp).toBe("");
    expect(contact.instagram).toBe("");
  });

  it("defaults to USD with tax and pickup disabled", () => {
    const commerce = parseSettings("commerce", {});
    expect(commerce.currencyCode).toBe("USD");
    expect(commerce.currencyDecimals).toBe(2);
    expect(commerce.taxEnabled).toBe(false);
    expect(parseSettings("pickup", undefined).enabled).toBe(false);
  });

  it("keeps valid fields and drops invalid ones", () => {
    const contact = parseSettings("contact", { email: "not-an-email", phone: "+961 1 234 567", whatsapp: "96170abc" });
    expect(contact.email).toBe("");
    expect(contact.whatsapp).toBe("");
    expect(contact.phone).toBe("+961 1 234 567");
  });
});

describe("text helpers", () => {
  it("slugifies names", () => {
    expect(slugify("Concrete Candle Jar – Large!")).toBe("concrete-candle-jar-large");
    expect(slugify("Crème Brûlée Candle")).toBe("creme-brulee-candle");
    expect(slugify("Gifts & Favors")).toBe("gifts-and-favors");
    expect(slugify("Mother's Day")).toBe("mothers-day");
    expect(slugify("Home décor & art")).toBe("home-decor-and-art");
    expect(slugify("!!!")).toBe("item");
    expect(isValidSlug("baptism-favors")).toBe(true);
    expect(isValidSlug("Bad Slug")).toBe(false);
  });

  it("only allows safe links", () => {
    expect(safeHref("/collections/christmas")).toBe("/collections/christmas");
    expect(safeHref("https://instagram.com/x")).toBe("https://instagram.com/x");
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("//evil.example")).toBeNull();
  });

  it("strips control characters", () => {
    expect(stripControlChars("a\u0000b\u0007c")).toBe("abc");
    expect(stripControlChars("a\nb", true)).toBe("a\nb");
  });
});
