/**
 * Role-based permissions for the admin dashboard. Every protected server action
 * and route checks one of these on the server — hiding a button is never the
 * only protection. Covered by tests/unit/auth.test.ts.
 */

import type { Role } from "../domain";

export const PERMISSIONS = [
  "dashboard:view",
  "analytics:view",
  "products:manage",
  "catalog:manage", // categories, collections, attributes
  "orders:view",
  "orders:manage",
  "payments:verify",
  "customers:view",
  "requests:manage", // custom requests, inquiries
  "reviews:manage",
  "discounts:manage",
  "content:manage", // homepage, pages, FAQ
  "newsletter:manage",
  "settings:manage", // store settings, delivery zones
  "payment-methods:manage",
  "staff:manage",
  "audit:view",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const STAFF_PERMISSIONS: Permission[] = [
  "dashboard:view",
  "products:manage",
  "catalog:manage",
  "orders:view",
  "orders:manage",
  "customers:view",
  "requests:manage",
  "reviews:manage",
];

const ADMIN_PERMISSIONS: Permission[] = PERMISSIONS.filter((p) => p !== "staff:manage");

const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  CUSTOMER: new Set(),
  STAFF: new Set(STAFF_PERMISSIONS),
  ADMIN: new Set(ADMIN_PERMISSIONS),
  OWNER: new Set(PERMISSIONS),
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

export function isStaffRole(role: Role): boolean {
  return role === "STAFF" || role === "ADMIN" || role === "OWNER";
}

export const ROLE_LABEL: Record<Role, string> = {
  CUSTOMER: "Customer",
  STAFF: "Staff",
  ADMIN: "Administrator",
  OWNER: "Owner",
};

/** Roles an actor may assign. Only owners manage administrators and owners. */
export function assignableRoles(actor: Role): Role[] {
  if (actor === "OWNER") return ["CUSTOMER", "STAFF", "ADMIN", "OWNER"];
  return [];
}
