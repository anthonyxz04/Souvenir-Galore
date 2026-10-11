/**
 * Zod schemas for public and customer forms. Every Server Action validates its
 * input with one of these before touching the database.
 */

import { z } from "zod";

export type FormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Echo of submitted values so forms keep their content after an error. */
  values?: Record<string, string>;
  /** Optional payload for client components (e.g. new cart count). */
  data?: Record<string, unknown>;
};

export const initialFormState: FormState = { status: "idle" };

export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

/** FormData → plain object of trimmed strings (files and repeated keys are ignored). */
export function formValues(formData: FormData, omit: string[] = ["password", "currentPassword", "newPassword", "confirmPassword"]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string" || key.startsWith("$ACTION") || omit.includes(key)) continue;
    if (!(key in values)) values[key] = value;
  }
  return values;
}

export function errorState(message: string, fieldErrors?: Record<string, string>, formData?: FormData): FormState {
  return { status: "error", message, fieldErrors, values: formData ? formValues(formData) : undefined };
}

export const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal("1"), z.literal(""), z.null(), z.undefined()])
  .transform((v) => v === "on" || v === "true" || v === "1");

const optionalString = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters.`)
    .optional()
    .transform((v) => (v ? v : null));

export const nameField = z.string().trim().min(1, "Enter your name.").max(100, "Use at most 100 characters.");
export const emailField = z.string().trim().toLowerCase().min(1, "Enter your email address.").email("Enter a valid email address.").max(200);
export const phoneField = z
  .string()
  .trim()
  .min(6, "Enter a phone number we can reach you on.")
  .max(30, "Enter a shorter phone number.")
  .regex(/^\+?[\d\s()-]+$/, "Use digits, spaces, brackets, + or -.");
export const optionalPhoneField = z
  .union([z.literal(""), phoneField])
  .optional()
  .transform((v) => (v ? v : null));

export const registerSchema = z.object({
  name: nameField,
  email: emailField,
  password: z.string().min(1, "Choose a password.").max(128),
  phone: optionalPhoneField,
  marketingOptIn: checkbox,
});

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Enter your password.").max(128),
});

export const forgotPasswordSchema = z.object({ email: emailField });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10).max(200),
    password: z.string().min(1, "Choose a new password.").max(128),
    confirmPassword: z.string().max(128),
  })
  .refine((v) => v.password === v.confirmPassword, { message: "The passwords don't match.", path: ["confirmPassword"] });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password.").max(128),
    newPassword: z.string().min(1, "Choose a new password.").max(128),
    confirmPassword: z.string().max(128),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { message: "The passwords don't match.", path: ["confirmPassword"] });

export const profileSchema = z.object({
  name: nameField,
  phone: optionalPhoneField,
  marketingOptIn: checkbox,
});

export const addressSchema = z.object({
  label: optionalString(40),
  recipientName: nameField,
  phone: phoneField,
  line1: z.string().trim().min(3, "Enter the street, building and floor.").max(200),
  line2: optionalString(200),
  city: z.string().trim().min(2, "Enter the town or city.").max(100),
  region: optionalString(100),
  instructions: optionalString(300),
  zoneId: optionalString(40),
  isDefault: checkbox,
});

export const checkoutSchema = z.object({
  email: emailField,
  name: nameField,
  phone: phoneField,
  fulfillment: z.enum(["DELIVERY", "PICKUP"], { errorMap: () => ({ message: "Choose delivery or pickup." }) }),
  savedAddressId: optionalString(40),
  recipientName: optionalString(100),
  addressPhone: optionalString(30),
  line1: optionalString(200),
  line2: optionalString(200),
  city: optionalString(100),
  region: optionalString(100),
  instructions: optionalString(300),
  zoneId: optionalString(40),
  saveAddress: checkbox,
  paymentMethodId: z.string().trim().min(1, "Choose a payment method.").max(40),
  customerNote: optionalString(1000),
  acceptTerms: checkbox,
  expectedTotal: z.coerce.number().int().nonnegative().optional(),
});

export const reviewSchema = z.object({
  productId: z.string().min(1).max(40),
  rating: z.coerce.number().int().min(1, "Choose a rating.").max(5),
  title: optionalString(120),
  body: z.string().trim().min(10, "Write at least a sentence or two.").max(2000, "Use at most 2000 characters."),
});

export const contactSchema = z.object({
  name: nameField,
  email: emailField,
  phone: optionalPhoneField,
  subject: optionalString(150),
  message: z.string().trim().min(10, "Tell us a little more (at least 10 characters).").max(3000),
});

export const productInquirySchema = z.object({
  productId: z.string().min(1).max(40),
  variantTitle: optionalString(200),
  quantity: z.coerce.number().int().min(1).max(10_000).optional(),
  name: nameField,
  email: emailField,
  phone: optionalPhoneField,
  message: z.string().trim().min(5, "Write your question.").max(3000),
  personalization: optionalString(2000),
});

export const customRequestSchema = z.object({
  name: nameField,
  email: emailField,
  phone: optionalPhoneField,
  contactPreference: z.enum(["EMAIL", "PHONE", "WHATSAPP", "INSTAGRAM"]).optional(),
  productType: z.string().trim().min(2, "Tell us what you'd like made.").max(150),
  productId: optionalString(40),
  occasion: optionalString(100),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1.").max(100_000).optional(),
  preferences: optionalString(1000),
  personalizationText: optionalString(1000),
  desiredDate: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))), "Enter a valid date.")
    .transform((v) => (v ? new Date(`${v}T00:00:00Z`) : null)),
  budgetRange: optionalString(60),
  details: z.string().trim().min(10, "Describe your idea in a few words (at least 10 characters).").max(4000),
});

export const newsletterSchema = z.object({
  email: emailField,
  consent: checkbox.refine((v) => v, "Please confirm you'd like to receive emails."),
});

export const paymentReferenceSchema = z.object({
  orderId: z.string().min(1).max(40),
  token: optionalString(200),
  reference: z.string().trim().min(3, "Enter the transaction reference.").max(120),
  note: optionalString(500),
});
