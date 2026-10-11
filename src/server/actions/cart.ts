"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { hashIp } from "@/lib/auth/crypto";
import { getCurrentUser } from "@/lib/auth/session";
import { addToCart, CartError, getCart, removeCartItem, setCartDiscountCode, updateCartItemQuantity } from "@/lib/cart/service";
import { checkDiscount, discountErrorMessage, normalizeDiscountCode } from "@/lib/discounts/evaluate";
import { formatMoney } from "@/lib/money";
import { checkLimit, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { getRequestMeta } from "@/lib/request";
import { getCurrency } from "@/lib/settings";
import { errorState, type FormState } from "@/lib/validation/forms";

export async function addToCartAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const variantId = String(formData.get("variantId") ?? "");
  const quantity = Number(formData.get("quantity") ?? 1);
  if (!variantId) return errorState("Choose an option first.");

  const personalization: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("p_") && typeof value === "string") personalization[key.slice(2)] = value;
  }

  try {
    const { count } = await addToCart({ variantId, quantity, personalization });
    revalidatePath("/", "layout");
    return { status: "success", message: quantity > 1 ? `Added ${quantity} to your cart.` : "Added to your cart.", data: { count } };
  } catch (error) {
    if (error instanceof CartError) return errorState(error.message);
    throw error;
  }
}

export async function updateCartQuantityAction(formData: FormData): Promise<void> {
  const itemId = String(formData.get("itemId") ?? "");
  const quantity = Number(formData.get("quantity") ?? 1);
  try {
    await updateCartItemQuantity(itemId, quantity);
  } catch (error) {
    if (!(error instanceof CartError)) throw error;
  }
  revalidatePath("/", "layout");
}

export async function removeCartItemAction(formData: FormData): Promise<void> {
  const itemId = String(formData.get("itemId") ?? "");
  try {
    await removeCartItem(itemId);
  } catch (error) {
    if (!(error instanceof CartError)) throw error;
  }
  revalidatePath("/", "layout");
}

export async function applyDiscountAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = String(formData.get("code") ?? "");
  const code = normalizeDiscountCode(raw).slice(0, 40);
  if (!code) return errorState("Enter a discount code.");
  const { ip } = await getRequestMeta();
  if (!(await checkLimit("discountCode", hashIp(ip)))) return errorState(RATE_LIMIT_MESSAGE);

  const [cart, currency, user] = await Promise.all([getCart(), getCurrency(), getCurrentUser()]);
  if (cart.lines.length === 0) return errorState("Add something to your cart first.");
  const discount = await prisma.discount.findUnique({ where: { code } });
  const customerRedemptions =
    discount && user
      ? await prisma.discountRedemption.count({ where: { discountId: discount.id, OR: [{ userId: user.id }, { email: user.email }] } })
      : null;
  const check = checkDiscount(discount, { subtotal: cart.subtotal, customerRedemptions });
  if (!check.ok) return errorState(discountErrorMessage(check, (m) => formatMoney(m, currency)));

  await setCartDiscountCode(code);
  revalidatePath("/cart");
  revalidatePath("/checkout");
  return { status: "success", message: `Code ${code} applied.` };
}

export async function removeDiscountAction(): Promise<void> {
  await setCartDiscountCode(null);
  revalidatePath("/cart");
  revalidatePath("/checkout");
}

export async function goToCheckoutAction(): Promise<void> {
  redirect("/checkout");
}
