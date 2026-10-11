/**
 * Starting templates for policy pages. Every page is created with
 * `needsOwnerReview: true`. Text in [square brackets] must be replaced with the
 * business's real details. These templates are not legal advice — have the
 * privacy policy and terms reviewed by a lawyer before launch.
 */

export const POLICY_PAGES: { slug: string; title: string; body: string; footerGroup: string; showInFooter: boolean; isPublished: boolean }[] = [
  {
    slug: "about",
    title: "About Souvenir Galore",
    footerGroup: "help",
    showInFooter: true,
    isPublished: true,
    body: `Souvenir Galore is a handmade gift and décor studio in Lebanon. We make candles, personalized gifts, favors for weddings and baptisms, religious keepsakes and decorative pieces in concrete, plaster and resin.

## How we work

[Tell your story here: who you are, when you started, where the workshop is, and what you love about making things by hand.]

## Made to order

Many pieces are made after you order, so they can carry a name, a date or a message. Each product page shows how long it usually takes to make.

## Get in touch

Questions, ideas or a large order for an event? [Contact us](/contact) or [send a custom request](/custom-order).`,
  },
  {
    slug: "delivery-and-pickup",
    title: "Delivery & pickup",
    footerGroup: "policies",
    showInFooter: true,
    isPublished: true,
    body: `## Where we deliver

We deliver to the areas listed at checkout. The delivery fee for your area is shown before you place your order.

[Describe which areas you cover, your courier, and any areas you don't serve.]

## How long it takes

- **Ready-made pieces:** usually dispatched within [X] working days.
- **Made-to-order and personalized pieces:** the making time is shown on each product page. Delivery time is added once your piece is ready.
- **Delivery:** usually [X–Y] working days after dispatch, depending on your area.

These are estimates, not guarantees. We'll contact you if anything changes.

## Pickup

[If you offer pickup: explain where, when, and how customers know their order is ready. If not, remove this section.]

## Receiving your order

Please check your parcel when it arrives. If anything is damaged, contact us within [X] days with photos so we can help.`,
  },
  {
    slug: "returns-and-refunds",
    title: "Returns & refunds",
    footerGroup: "policies",
    showInFooter: true,
    isPublished: true,
    body: `Every piece is made by hand, so small variations in color, texture and finish are part of its character and aren't defects.

## Ready-made items

[State whether and when ready-made items can be returned — for example within X days of delivery, unused and in original packaging — and who pays return delivery.]

## Personalized and made-to-order items

Because they're made for you, personalized and made-to-order items [can't be returned unless they arrive damaged or with a mistake on our side]. Please check names, dates and messages carefully before ordering.

## Damaged or incorrect items

If something arrives damaged or isn't what you ordered, contact us within [X] days of delivery with your order number and photos. We'll offer a [replacement, repair or refund].

## Refunds

Approved refunds are returned [by the original payment method / by arrangement] within [X] days. Delivery fees are [refunded / not refunded] unless the mistake was ours.

## Cancellations

You can ask to cancel an order from your order page before we start making it. Once production has started, [explain your policy].`,
  },
  {
    slug: "custom-order-policy",
    title: "Custom orders",
    footerGroup: "policies",
    showInFooter: true,
    isPublished: true,
    body: `## Requests and quotes

Sending a custom request doesn't create an order or a payment. We review your request, ask any questions and send you a quote with the price and the expected timing.

## Confirming

Your custom order is confirmed only when you accept the quote [and pay the agreed deposit]. [State your deposit amount or percentage, if any, and when the balance is due.]

## Proofs and changes

[Explain whether you send a design proof, how many revisions are included, and until when changes are possible.]

## Timing

Handmade custom work takes time. Please allow at least [X] weeks for large orders such as wedding favors. We'll confirm a date with your quote.

## Cancellations

[Explain what happens if a confirmed custom order is cancelled — for example, whether deposits are refundable once materials have been bought or production has started.]`,
  },
  {
    slug: "privacy-policy",
    title: "Privacy policy",
    footerGroup: "policies",
    showInFooter: true,
    isPublished: true,
    body: `_Last reviewed: [date]. Have this policy reviewed by a lawyer before launch._

This policy explains what personal information [Legal business name] ("Souvenir Galore", "we") collects through this website and how it's used. Contact: [email address].

## What we collect

- **Account details** if you create an account: name, email address, optional phone number, and a securely hashed password (we can't see your password).
- **Order details:** name, email, phone, delivery address, items ordered, personalization text, payment method, and payment references you give us.
- **Custom requests and messages:** what you write to us and any reference images you upload.
- **Newsletter:** your email address and the consent you gave, if you subscribe.
- **Technical data:** to keep the site secure we record limited technical information. IP addresses are stored only as anonymized fingerprints for rate limiting and security logs.

## Cookies

We use cookies that are necessary for the site to work: one keeps you signed in, and one keeps your shopping cart. [If analytics are enabled: we use (Plausible, which does not use cookies) / (Google Analytics, only if you accept analytics cookies).]

## How we use it

To process and deliver orders, respond to requests, provide your account, prevent fraud and abuse, meet legal and accounting obligations, and — only if you subscribe — send our newsletter.

## Who we share it with

Only with service providers needed to run the store: [website hosting provider], [database provider], [email delivery provider], [delivery couriers], and [payment providers you choose]. We don't sell your personal information.

## How long we keep it

Account data is kept until you delete your account. Order records are kept for [X] years for accounting and legal reasons. Newsletter data is kept until you unsubscribe.

## Your choices and rights

You can view and update your details in your account, delete your account from Account → Password & security, and unsubscribe from emails at any time. To ask for a copy or deletion of your data, contact [email address].

This policy is intended to comply with Lebanese Law No. 81 of 2018 on Electronic Transactions and Personal Data and other laws that may apply to you. [Confirm with your lawyer.]

## Changes

We'll update this page if our practices change.`,
  },
  {
    slug: "terms-and-conditions",
    title: "Terms & conditions",
    footerGroup: "policies",
    showInFooter: true,
    isPublished: true,
    body: `_Last reviewed: [date]. Have these terms reviewed by a lawyer before launch._

These terms apply to purchases from Souvenir Galore, operated by [Legal business name], [registered address], [registration number if applicable].

## Orders

Placing an order is an offer to buy. We confirm orders by email. We may cancel an order if an item is unavailable, a price was clearly wrong, or payment isn't received — in which case any payment received is refunded.

## Prices and payment

Prices are shown in the store currency at checkout, including or excluding taxes as indicated. Orders paid by manual methods (such as bank transfer or Whish Money) are confirmed as paid only after we verify the payment. Cash on delivery is paid to the courier or at pickup.

## Handmade items

Each item is made by hand. Small variations from photos in color, size and finish are normal and aren't defects.

## Personalization

You're responsible for the accuracy of names, dates and messages you provide. We'll make the piece as written.

## Delivery, returns and custom orders

See our [Delivery & pickup](/pages/delivery-and-pickup), [Returns & refunds](/pages/returns-and-refunds) and [Custom orders](/pages/custom-order-policy) policies.

## Liability

[Limitation of liability wording — to be provided by your lawyer.]

## Governing law

These terms are governed by the laws of Lebanon. [Confirm with your lawyer.]

## Contact

[Email address], [phone number].`,
  },
];
