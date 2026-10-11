/**
 * Online payment gateway integrations.
 *
 * No gateway is installed. To add one (for example an official Whish Pay
 * merchant integration, once Whish provides API credentials and documentation),
 * a developer implements `PaymentProvider` using the provider's OFFICIAL API and
 * registers it below. Only registered providers can be enabled in the admin.
 *
 * Rules for any provider:
 *  - Never mark an order PAID from the browser redirect alone. Confirm the
 *    payment server-to-server (signed webhook or status API) before calling
 *    `markPaidFromGateway` (src/lib/orders/service.ts).
 *  - Keep credentials in environment variables, never in the database or code.
 *  - Make webhook handling idempotent (the same event may arrive twice).
 */

export type CreatePaymentInput = {
  orderId: string;
  orderNumber: string;
  amount: number; // minor units
  currency: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
};

export type CreatePaymentResult = { redirectUrl: string; providerRef: string };

export type VerifiedPayment = { orderId: string; providerRef: string; amount: number; currency: string; status: "succeeded" | "failed" };

export interface PaymentProvider {
  /** Stable key stored on PaymentMethod.provider, e.g. "whish-pay". */
  key: string;
  label: string;
  /** Environment variables that must be set before the provider can be enabled. */
  requiredEnv: string[];
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  /** Verify an incoming webhook/callback and return the confirmed result, or null if invalid. */
  verifyCallback(request: Request): Promise<VerifiedPayment | null>;
}

const providers: PaymentProvider[] = [
  // Register official integrations here, e.g.: whishPayProvider,
];

export function registeredProviders(): PaymentProvider[] {
  return providers.filter((provider) => provider.requiredEnv.every((name) => Boolean(process.env[name])));
}

export function registeredProviderKeys(): string[] {
  return registeredProviders().map((provider) => provider.key);
}

export function getProvider(key: string | null | undefined): PaymentProvider | undefined {
  return registeredProviders().find((provider) => provider.key === key);
}
