/**
 * Domain enums shared by pure (framework-free) modules.
 * These string unions mirror the Prisma enums in prisma/schema.prisma, so values
 * are interchangeable with the generated Prisma types.
 */

export const ROLES = ["CUSTOMER", "STAFF", "ADMIN", "OWNER"] as const;
export type Role = (typeof ROLES)[number];

export const ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "READY_FOR_PICKUP",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = [
  "UNPAID",
  "AWAITING_PAYMENT",
  "UNDER_REVIEW",
  "PAID",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
  "VOIDED",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHOD_TYPES = ["CASH_ON_DELIVERY", "WHISH_MONEY", "MANUAL", "ONLINE_GATEWAY"] as const;
export type PaymentMethodType = (typeof PAYMENT_METHOD_TYPES)[number];

export const FULFILLMENT_METHODS = ["DELIVERY", "PICKUP"] as const;
export type FulfillmentMethod = (typeof FULFILLMENT_METHODS)[number];

export const DISCOUNT_TYPES = ["PERCENTAGE", "FIXED_AMOUNT", "FREE_DELIVERY"] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export const PERSONALIZATION_FIELD_TYPES = ["TEXT", "TEXTAREA", "DATE", "SELECT"] as const;
export type PersonalizationFieldType = (typeof PERSONALIZATION_FIELD_TYPES)[number];

export const PRODUCT_STATUSES = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const CUSTOM_REQUEST_STATUSES = [
  "NEW",
  "IN_REVIEW",
  "QUOTED",
  "ACCEPTED",
  "IN_PROGRESS",
  "COMPLETED",
  "DECLINED",
  "CANCELLED",
] as const;
export type CustomRequestStatus = (typeof CUSTOM_REQUEST_STATUSES)[number];
