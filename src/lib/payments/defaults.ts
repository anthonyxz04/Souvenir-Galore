/**
 * Payment methods created by the database seed. Every one is DISABLED.
 * No account names, numbers or credentials are invented — the owner adds them
 * in Admin → Payments when ready, and a method can only be enabled once its
 * required details are present (see rules.ts).
 */

import type { PaymentMethodType } from "../domain";

export type DefaultPaymentMethod = {
  code: string;
  type: PaymentMethodType;
  name: string;
  description: string;
  instructions: string;
  isEnabled: false;
  requiresManualVerification: boolean;
  allowCustomerReference: boolean;
  availableForDelivery: boolean;
  availableForPickup: boolean;
  position: number;
  config: Record<string, string>;
};

export const DEFAULT_PAYMENT_METHODS: DefaultPaymentMethod[] = [
  {
    code: "cash-on-delivery",
    type: "CASH_ON_DELIVERY",
    name: "Cash on delivery",
    description: "Pay in cash when your order arrives or when you pick it up.",
    instructions: "",
    isEnabled: false,
    requiresManualVerification: true,
    allowCustomerReference: false,
    availableForDelivery: true,
    availableForPickup: true,
    position: 0,
    config: {},
  },
  {
    code: "whish-money",
    type: "WHISH_MONEY",
    name: "Whish Money",
    description: "Send the amount from your Whish app. We confirm your payment before preparing your order.",
    instructions: "",
    isEnabled: false,
    requiresManualVerification: true,
    allowCustomerReference: true,
    availableForDelivery: true,
    availableForPickup: true,
    position: 1,
    config: {},
  },
  {
    code: "bank-transfer",
    type: "MANUAL",
    name: "Bank transfer",
    description: "Transfer the amount to our account. We confirm your payment before preparing your order.",
    instructions: "",
    isEnabled: false,
    requiresManualVerification: true,
    allowCustomerReference: true,
    availableForDelivery: true,
    availableForPickup: true,
    position: 2,
    config: {},
  },
];
