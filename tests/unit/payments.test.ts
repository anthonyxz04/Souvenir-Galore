import { describe, expect, it } from "vitest";
import {
  canEnable,
  initialPaymentStatus,
  isMethodAvailable,
  missingRequirements,
  paymentDetailsForCustomer,
  sanitizeConfig,
} from "@/lib/payments/rules";
import { DEFAULT_PAYMENT_METHODS } from "@/lib/payments/defaults";

describe("default payment methods", () => {
  it("are all disabled by default", () => {
    expect(DEFAULT_PAYMENT_METHODS.length).toBeGreaterThanOrEqual(3);
    for (const method of DEFAULT_PAYMENT_METHODS) expect(method.isEnabled).toBe(false);
  });

  it("include Whish Money without any invented account details", () => {
    const whish = DEFAULT_PAYMENT_METHODS.find((m) => m.type === "WHISH_MONEY");
    expect(whish).toBeDefined();
    expect(whish?.isEnabled).toBe(false);
    expect(whish?.config).toEqual({});
    expect(whish?.instructions ?? "").toBe("");
    expect(whish?.requiresManualVerification).toBe(true);
  });

  it("include cash on delivery and manual transfer", () => {
    expect(DEFAULT_PAYMENT_METHODS.some((m) => m.type === "CASH_ON_DELIVERY")).toBe(true);
    expect(DEFAULT_PAYMENT_METHODS.some((m) => m.type === "MANUAL")).toBe(true);
  });
});

describe("enabling payment methods", () => {
  it("blocks Whish Money until the owner supplies the required details", () => {
    const whish = { type: "WHISH_MONEY" as const, name: "Whish Money", instructions: "", config: {}, provider: null };
    expect(canEnable(whish)).toBe(false);
    expect(missingRequirements(whish)).toEqual([
      "Payment instructions for customers",
      "Account holder name",
      "Whish account / phone number",
    ]);

    const configured = {
      ...whish,
      instructions: "Send the total in USD and enter the transaction reference.",
      config: { accountName: "Owner Name", accountNumber: "00000000" },
    };
    expect(canEnable(configured)).toBe(true);
  });

  it("treats whitespace-only values as missing", () => {
    const whish = {
      type: "WHISH_MONEY" as const,
      name: "Whish Money",
      instructions: "   ",
      config: { accountName: "  ", accountNumber: "1" },
      provider: null,
    };
    expect(missingRequirements(whish)).toContain("Account holder name");
    expect(missingRequirements(whish)).toContain("Payment instructions for customers");
  });

  it("lets cash on delivery be enabled with no extra details", () => {
    expect(canEnable({ type: "CASH_ON_DELIVERY", name: "Cash on delivery", instructions: null, config: {}, provider: null })).toBe(true);
  });

  it("requires instructions for manual payments", () => {
    expect(canEnable({ type: "MANUAL", name: "Bank transfer", instructions: "", config: {}, provider: null })).toBe(false);
    expect(canEnable({ type: "MANUAL", name: "Bank transfer", instructions: "Pay to…", config: {}, provider: null })).toBe(true);
  });

  it("refuses online gateways without a registered integration", () => {
    const gateway = { type: "ONLINE_GATEWAY" as const, name: "Cards", instructions: null, config: {}, provider: "acme" };
    expect(canEnable(gateway, [])).toBe(false);
    expect(canEnable(gateway, ["acme"])).toBe(true);
  });
});

describe("availability at checkout", () => {
  const method = { isEnabled: true, availableForDelivery: true, availableForPickup: false, minOrderTotal: 1000, maxOrderTotal: 50_000 };

  it("hides disabled methods", () => {
    expect(isMethodAvailable({ ...method, isEnabled: false }, { fulfillment: "DELIVERY", total: 5000 })).toBe(false);
  });

  it("respects order type", () => {
    expect(isMethodAvailable(method, { fulfillment: "DELIVERY", total: 5000 })).toBe(true);
    expect(isMethodAvailable(method, { fulfillment: "PICKUP", total: 5000 })).toBe(false);
  });

  it("respects order total limits", () => {
    expect(isMethodAvailable(method, { fulfillment: "DELIVERY", total: 999 })).toBe(false);
    expect(isMethodAvailable(method, { fulfillment: "DELIVERY", total: 50_001 })).toBe(false);
  });
});

describe("payment status", () => {
  it("never starts an order as paid", () => {
    expect(initialPaymentStatus("CASH_ON_DELIVERY")).toBe("UNPAID");
    expect(initialPaymentStatus("WHISH_MONEY")).toBe("AWAITING_PAYMENT");
    expect(initialPaymentStatus("MANUAL")).toBe("AWAITING_PAYMENT");
    expect(initialPaymentStatus("ONLINE_GATEWAY")).toBe("AWAITING_PAYMENT");
  });
});

describe("config handling", () => {
  it("keeps only known fields for the method type", () => {
    expect(
      sanitizeConfig("WHISH_MONEY", { accountName: " Name ", accountNumber: "123", evil: "<script>", iban: "x" }),
    ).toEqual({ accountName: "Name", accountNumber: "123" });
  });

  it("shows customers only filled-in details", () => {
    expect(
      paymentDetailsForCustomer({
        type: "WHISH_MONEY",
        name: "Whish",
        instructions: "x",
        config: { accountName: "Name", accountNumber: "123" },
        provider: null,
      }),
    ).toEqual([
      { label: "Account holder name", value: "Name" },
      { label: "Whish account / phone number", value: "123" },
    ]);
  });
});
