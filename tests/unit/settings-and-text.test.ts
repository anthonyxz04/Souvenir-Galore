import { describe, expect, it } from "vitest";
import { parseSettings } from "@/lib/settings/schemas";
import { instagramUsername, isValidSlug, safeHref, slugify, stripControlChars, whatsappNumber } from "@/lib/text";

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

describe("contact details typed by the owner", () => {
  it("turns an Instagram profile link or @name into the username", () => {
    expect(instagramUsername("https://www.instagram.com/souvenir.galore?igsh=abc123")).toBe("souvenir.galore");
    expect(instagramUsername("instagram.com/souvenir.galore/")).toBe("souvenir.galore");
    expect(instagramUsername("@souvenir.galore")).toBe("souvenir.galore");
    expect(instagramUsername("souvenir.galore")).toBe("souvenir.galore");
  });

  it("adds Lebanon's country code to a local WhatsApp number", () => {
    expect(whatsappNumber("76 620 434")).toBe("96176620434");
    expect(whatsappNumber("03 123 456")).toBe("9613123456");
    expect(whatsappNumber("+961 76 620 434")).toBe("96176620434");
    expect(whatsappNumber("00961 76 620 434")).toBe("96176620434");
    expect(whatsappNumber("+44 20 7946 0958")).toBe("442079460958");
    expect(whatsappNumber("")).toBe("");
  });

  it("saved values pass the settings rules", () => {
    const contact = parseSettings("contact", { email: "souvenirgalore@outlook.com", phone: "+961 76 620 434", whatsapp: whatsappNumber("76620434"), instagram: instagramUsername("https://www.instagram.com/souvenir.galore?exln=x") });
    expect(contact.whatsapp).toBe("96176620434");
    expect(contact.instagram).toBe("souvenir.galore");
    expect(contact.email).toBe("souvenirgalore@outlook.com");
  });
});
