/**
 * Payment-method rules: what each method type needs before it can be enabled,
 * when it can be offered at checkout, and the payment status a new order starts in.
 *
 * Important business rules (covered by tests/unit/payments.test.ts):
 *  - Every method is disabled by default.
 *  - Whish Money cannot be enabled until the owner has entered the account
 *    holder, the Whish account number and customer instructions.
 *  - Manual methods start orders as AWAITING_PAYMENT; a customer saying they
 *    paid only moves the order to UNDER_REVIEW. Only an administrator can mark
 *    a payment as PAID.
 */

import type { FulfillmentMethod, PaymentMethodType, PaymentStatus } from "../domain";

export type ConfigField = {
  key: string;
  label: string;
  help?: string;
  required: boolean;
  multiline?: boolean;
};

export type PaymentTypeInfo = {
  label: string;
  summary: string;
  configFields: ConfigField[];
  instructionsRequired: boolean;
  defaultRequiresManualVerification: boolean;
  defaultAllowCustomerReference: boolean;
};

export const PAYMENT_TYPE_INFO: Record<PaymentMethodType, PaymentTypeInfo> = {
  CASH_ON_DELIVERY: {
    label: "Cash on delivery / pay at pickup",
    summary: "The customer pays in cash when the order is delivered or picked up. Mark the payment as received from the order page.",
    configFields: [],
    instructionsRequired: false,
    defaultRequiresManualVerification: true,
    defaultAllowCustomerReference: false,
  },
  WHISH_MONEY: {
    label: "Whish Money (manual transfer)",
    summary:
      "The customer sends the amount to your Whish account using the Whish app, then enters the transaction reference. You confirm the money arrived before the order is marked paid. This is a manual workflow — no automatic Whish integration is active.",
    configFields: [
      { key: "accountName", label: "Account holder name", required: true, help: "Name customers will see on the Whish transfer." },
      {
        key: "accountNumber",
        label: "Whish account / phone number",
        required: true,
        help: "The number customers send money to. Double-check it — customers will copy it exactly.",
      },
      { key: "currencyNote", label: "Currency note", required: false, help: "e.g. “Send the amount in USD.”" },
    ],
    instructionsRequired: true,
    defaultRequiresManualVerification: true,
    defaultAllowCustomerReference: true,
  },
  MANUAL: {
    label: "Manual payment (bank transfer or other)",
    summary: "Show your own payment details and instructions. You confirm each payment manually before the order is marked paid.",
    configFields: [
      { key: "bankName", label: "Bank / provider name", required: false },
      { key: "accountName", label: "Account holder name", required: false },
      { key: "accountNumber", label: "Account number", required: false },
      { key: "iban", label: "IBAN", required: false },
      { key: "swift", label: "SWIFT / BIC", required: false },
    ],
    instructionsRequired: true,
    defaultRequiresManualVerification: true,
    defaultAllowCustomerReference: true,
  },
  ONLINE_GATEWAY: {
    label: "Online payment gateway",
    summary:
      "Card or wallet payments processed by a payment provider. A developer must add the provider's official integration in src/lib/payments/providers before this can be enabled.",
    configFields: [],
    instructionsRequired: false,
    defaultRequiresManualVerification: false,
    defaultAllowCustomerReference: false,
  },
};

export type PaymentMethodLike = {
  type: PaymentMethodType;
  name: string;
  instructions: string | null;
  config: Record<string, unknown> | null;
  provider: string | null;
};

function configValue(config: Record<string, unknown> | null, key: string): string {
  const value = config?.[key];
  return typeof value === "string" ? value.trim() : "";
}

/** Human-readable list of what is still missing before this method can be enabled. */
export function missingRequirements(method: PaymentMethodLike, registeredProviders: string[] = []): string[] {
  const info = PAYMENT_TYPE_INFO[method.type];
  const missing: string[] = [];
  if (!method.name.trim()) missing.push("Name shown to customers");
  if (info.instructionsRequired && !(method.instructions ?? "").trim()) missing.push("Payment instructions for customers");
  for (const field of info.configFields) {
    if (field.required && !configValue(method.config, field.key)) missing.push(field.label);
  }
  if (method.type === "ONLINE_GATEWAY") {
    if (!method.provider || !registeredProviders.includes(method.provider)) {
      missing.push("An installed payment-provider integration (developer task)");
    }
  }
  return missing;
}

export function canEnable(method: PaymentMethodLike, registeredProviders: string[] = []): boolean {
  return missingRequirements(method, registeredProviders).length === 0;
}

export type AvailabilityMethod = {
  isEnabled: boolean;
  availableForDelivery: boolean;
  availableForPickup: boolean;
  minOrderTotal: number | null;
  maxOrderTotal: number | null;
};

export function isMethodAvailable(
  method: AvailabilityMethod,
  context: { fulfillment: FulfillmentMethod; total: number },
): boolean {
  if (!method.isEnabled) return false;
  if (context.fulfillment === "DELIVERY" && !method.availableForDelivery) return false;
  if (context.fulfillment === "PICKUP" && !method.availableForPickup) return false;
  if (method.minOrderTotal !== null && context.total < method.minOrderTotal) return false;
  if (method.maxOrderTotal !== null && context.total > method.maxOrderTotal) return false;
  return true;
}

/** The payment status a brand-new order starts in. Never PAID. */
export function initialPaymentStatus(type: PaymentMethodType): PaymentStatus {
  switch (type) {
    case "CASH_ON_DELIVERY":
      return "UNPAID";
    case "WHISH_MONEY":
    case "MANUAL":
    case "ONLINE_GATEWAY":
      return "AWAITING_PAYMENT";
  }
}

/** Customer-facing payment details, built only from administrator-entered values. */
export function paymentDetailsForCustomer(method: PaymentMethodLike): { label: string; value: string }[] {
  const info = PAYMENT_TYPE_INFO[method.type];
  return info.configFields
    .map((field) => ({ label: field.label, value: configValue(method.config, field.key) }))
    .filter((entry) => entry.value !== "");
}

/** Sanitize an admin-submitted config object to the known string fields for the type. */
export function sanitizeConfig(type: PaymentMethodType, input: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const field of PAYMENT_TYPE_INFO[type].configFields) {
    const value = input[field.key];
    if (typeof value === "string" && value.trim()) result[field.key] = value.trim().slice(0, 500);
  }
  return result;
}
