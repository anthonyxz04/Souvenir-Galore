import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getCart } from "@/lib/cart/service";
import { checkDiscount, describeDiscount, discountErrorMessage, normalizeDiscountCode, type DiscountRule } from "@/lib/discounts/evaluate";
import { formatMoney } from "@/lib/money";
import { canEnable, paymentDetailsForCustomer } from "@/lib/payments/rules";
import { registeredProviderKeys } from "@/lib/payments/providers";
import { getAllSettings } from "@/lib/settings";
import { publicMediaBase } from "@/lib/storage";
import { Container, PageHeading } from "@/components/ui/misc";
import { Notice } from "@/components/ui/form-message";
import { ButtonLink } from "@/components/ui/button";
import { CheckoutForm } from "@/components/checkout/checkout-form";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const [cart, settings, user] = await Promise.all([getCart(), getAllSettings(), getCurrentUser()]);
  if (cart.lines.length === 0) redirect("/cart");
  if (cart.hasIssues) redirect("/cart");

  const { commerce, pickup, contact } = settings;
  const currency = { code: commerce.currencyCode, decimals: commerce.currencyDecimals, locale: commerce.currencyLocale };
  const fmt = (minor: number) => formatMoney(minor, currency);

  if (!user && !commerce.allowGuestCheckout) redirect("/login?next=/checkout");
  if (commerce.minOrderSubtotal > 0 && cart.subtotal < commerce.minOrderSubtotal) redirect("/cart");

  const [zones, enabledMethods, addresses] = await Promise.all([
    prisma.deliveryZone.findMany({ where: { isActive: true }, orderBy: [{ position: "asc" }, { name: "asc" }] }),
    prisma.paymentMethod.findMany({ where: { isEnabled: true }, orderBy: [{ position: "asc" }, { name: "asc" }] }),
    user ? prisma.address.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }] }) : Promise.resolve([]),
  ]);

  const providers = registeredProviderKeys();
  const methods = enabledMethods.filter((method) => canEnable({ ...method, config: (method.config ?? {}) as Record<string, unknown> }, providers));
  const canDeliver = zones.length > 0;
  const canPickup = pickup.enabled;

  if (methods.length === 0 || (!canDeliver && !canPickup)) {
    return (
      <Container className="py-12 sm:py-16">
        <PageHeading title="Checkout" />
        <Notice tone="info" title="Online checkout isn't open yet" className="mt-8 max-w-2xl">
          <p>We&apos;re setting up {methods.length === 0 ? "payment options" : "delivery options"}. In the meantime you can order by message — tell us what&apos;s in your cart and we&apos;ll confirm the details.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {contact.whatsapp ? (
              <a href={`https://wa.me/${contact.whatsapp}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                Message us on WhatsApp
              </a>
            ) : null}
            <Link href="/contact" className="underline underline-offset-4">
              Contact us
            </Link>
          </div>
        </Notice>
        <ButtonLink href="/cart" variant="secondary" className="mt-6">
          Back to cart
        </ButtonLink>
      </Container>
    );
  }

  let discount: { rule: DiscountRule; label: string } | null = null;
  let discountError: string | null = null;
  if (cart.discountCode) {
    const record = await prisma.discount.findUnique({ where: { code: normalizeDiscountCode(cart.discountCode) } });
    const redemptions =
      record && user ? await prisma.discountRedemption.count({ where: { discountId: record.id, OR: [{ userId: user.id }, { email: user.email }] } }) : null;
    const check = checkDiscount(record, { subtotal: cart.subtotal, customerRedemptions: redemptions });
    if (check.ok) discount = { rule: check.rule, label: `${check.code} — ${describeDiscount(check.rule, fmt)}` };
    else discountError = `Code ${cart.discountCode}: ${discountErrorMessage(check, fmt)}`;
  }

  return (
    <Container wide className="py-10 sm:py-14">
      <PageHeading title="Checkout" />
      {discountError ? (
        <Notice tone="warning" className="mt-6 max-w-2xl">
          {discountError}{" "}
          <Link href="/cart" className="underline underline-offset-4">
            Update your cart
          </Link>
        </Notice>
      ) : null}
      <CheckoutForm
        base={publicMediaBase()}
        currency={currency}
        lines={cart.lines.map((line) => ({
          id: line.id,
          name: line.productName,
          variantTitle: line.variantTitle,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          personalizationPrice: line.personalizationPrice,
          lineTotal: line.lineTotal,
          personalization: line.personalization,
          image: line.image,
        }))}
        discount={discountError ? null : discount}
        tax={{ enabled: commerce.taxEnabled, rateBps: commerce.taxRateBps, included: commerce.taxIncluded, label: commerce.taxLabel }}
        zones={zones.map((zone) => ({ id: zone.id, name: zone.name, description: zone.description, fee: zone.fee, freeAboveSubtotal: zone.freeAboveSubtotal, minDays: zone.minDays, maxDays: zone.maxDays }))}
        pickup={canPickup ? { locationName: pickup.locationName, address: pickup.address, hours: pickup.hours, instructions: pickup.instructions } : null}
        methods={methods.map((method) => ({
          id: method.id,
          type: method.type,
          name: method.name,
          description: method.description,
          instructions: method.instructions,
          details: paymentDetailsForCustomer({ ...method, config: (method.config ?? {}) as Record<string, unknown> }),
          requiresManualVerification: method.requiresManualVerification,
          isEnabled: method.isEnabled,
          availableForDelivery: method.availableForDelivery,
          availableForPickup: method.availableForPickup,
          minOrderTotal: method.minOrderTotal,
          maxOrderTotal: method.maxOrderTotal,
        }))}
        user={user ? { name: user.name, email: user.email, phone: user.phone } : null}
        addresses={addresses.map((a) => ({
          id: a.id,
          label: a.label,
          recipientName: a.recipientName,
          phone: a.phone,
          line1: a.line1,
          line2: a.line2,
          city: a.city,
          region: a.region,
          deliveryZoneId: a.deliveryZoneId,
        }))}
        requireTerms={commerce.requireTermsAcceptance}
      />
    </Container>
  );
}
