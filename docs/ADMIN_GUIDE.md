# Running the store: dashboard guide

The dashboard is at `/admin`. Sign in at `/login` with a staff account. Visitors without staff access get a "page not found" response.

## Roles

| Role | Can do |
|---|---|
| **Owner** | Everything, including managing staff and other owners |
| **Administrator** | Everything except managing staff |
| **Staff** | Products, inventory, catalog, orders (status, notes), customers (view), custom requests, messages, reviews. Staff can't verify payments, change payment methods or settings, or see analytics. |

Add staff in **Dashboard → Staff**. The person first registers a normal account on the site and confirms their email; the Owner then enters that email and picks a role. A role change signs that person out of all devices. To remove someone's access, set their role back to Customer, or disable the account.

## First-time setup

The dashboard shows a **Before you start selling** list until each item is done. The full checklist is in [GO_LIVE_CHECKLIST.md](GO_LIVE_CHECKLIST.md).

1. **Settings → Business:** store name, description, logo, business address (optional).
   - An uploaded logo replaces the wax-seal mark in the header and mobile menu. It keeps its proportions; a wide logo works best (around 3:1).
   - The browser-tab icon, home-screen icon and the default social sharing image are files in the code: `src/app/favicon.ico`, `src/app/icon.svg`, `src/app/apple-icon.png`, `public/icons/` and `public/og-image.png`. To use a different logo there, a developer replaces those files and redeploys. You can choose a different sharing image yourself in **Settings → Search engines**.
2. **Settings → Contact & social:** email, phone, WhatsApp number (international format, e.g. `+961…`), Instagram username, Facebook and TikTok links. Each contact button on the site appears only once its detail is filled in.
3. **Settings → Prices & checkout:**
   - currency (USD by default)
   - tax: none, included in prices, or added at checkout
   - minimum order
   - free-delivery threshold
   - guest checkout on or off
   - the price bands used by the gift finder
   - the low-stock warning level
4. **Delivery & pickup:**
   - Set the fee and delivery time for each area, then switch each area **on**. All areas start off.
   - Turn on pickup and add the pickup location and hours if you offer it.
5. **Payments:** enter the details for the methods you'll accept and enable them. See [PAYMENTS.md](PAYMENTS.md).
6. **Pages & policies:**
   - Edit every page marked **Needs owner review**: delivery, returns and refunds, custom orders, privacy and terms.
   - Replace every `[placeholder]`, check the content against how you actually work, then untick **Needs owner review**.
   - Have the privacy policy and terms checked by a qualified professional.
7. **Homepage:** check each section, add a hero image, and write the **Craftsmanship** section with your real story before switching it on (it starts hidden).
8. **Products:** add your products (below), then publish them. While the shop is empty, the dashboard offers **Add sample products**, 12 clearly labelled samples for trying the shop. **Remove sample products** deletes them again.

## Orders

**Dashboard → Orders** lists every order. You can filter by order status, payment status, and delivery or pickup, and search by order number, name, email or phone.

An order has two independent statuses:

- **Order status** follows the goods: *Pending → Confirmed → Preparing → Out for delivery or Ready for pickup → Delivered or Picked up*. An order can be cancelled at any point before delivery. Only valid next steps are offered.
- **Payment status** follows the money. See [PAYMENTS.md](PAYMENTS.md#payment-statuses).

On the order page you can:
- change the status, with an optional message to the customer. The customer is emailed and sees it in their order timeline.
- verify or reject a payment, mark cash as received, and record refunds. These need payment permission.
- add **notes**: internal (staff only) or visible to the customer.
- see the full **history**: who did what and when.
- see the personalization text exactly as the customer typed it, to copy into production.
- see cancellation requests from the customer.
- **Print** the order as a packing sheet. The dashboard menus are hidden when printing.

**Cancelling** returns reserved stock to inventory, voids an unpaid payment and frees the discount use. It can't be undone.

**Export:** download the orders list as CSV from the orders page. Values are written so that spreadsheet formulas can't be injected.

## Products

**Dashboard → Products → New product**.

- **Basics:** name, short description, full description (Markdown formatting), categories, collections, tags (occasion, recipient, color, material, scent). Tags power the shop filters and the gift finder.
- **Images:**
  - Drag and drop to upload and reorder; the first image is the main one.
  - Add **alt text** for each image, describing the piece for screen-reader users and search engines.
  - Photos are compressed in your browser, then checked and re-encoded on the server, which removes location and camera data.
- **Options and variants:** up to 3 options (e.g. *Size: Small, Large*; *Scent: Vanilla, Oud*). The editor creates every combination. Each variant has its own price, sale price, cost price (private, never shown to customers), SKU and stock.
- **Pricing:**
  - **Fixed price** is normal checkout.
  - **Quote only** is for bespoke work: no price or cart button; customers send a custom request instead.
  - Sale prices can have start and end dates.
- **Stock:**
  - **Track inventory**: stock goes down when an order is placed and back up if it's cancelled. Two customers can never buy the last item at the same time.
  - **Allow backorders**: customers can still order when stock is 0.
  - **Made to order**: no stock needed; the piece is made after ordering.
  - **Making time** (min–max days): shown on the product page and in the cart.
  - **Max per order** and a **low-stock warning level**.
- **Personalization fields:** short text, long text, date, or a list of choices. Each field can be required, have a character limit, a list of choices and a **surcharge**. Customers see the surcharge before adding to cart, and the server recalculates every price.
- **Badges:** featured, bestseller, limited edition. *New* and *On sale* badges are automatic.
- **Search engines:** optional custom title and description.
- **Status:** **Draft** (hidden), **Active** (visible), **Archived** (hidden, kept for order history).

Use **Duplicate** to start a similar product; the copy starts as a draft. Products that appear in orders can't be deleted, only archived.

### Inventory

**Dashboard → Inventory** shows stock for every variant. You can filter for low or out-of-stock items. **Adjust** a quantity with a reason (restock, return, correction); every change is logged with who made it. Stock for existing variants can only be changed through these logged adjustments, never by overwriting the number.

### Categories, collections and tags

- **Categories** form the main menu tree, for example *Candles → Scented candles*. Each can have an image and description, and can be hidden from the menu.
- **Collections** are curated groups such as seasonal (*Christmas*), occasion (*Wedding season*) or limited editions. They can have start and end dates and appear on the homepage. Seeded collections start unpublished.
- **Filters & tags** are groups like *Occasion* and *Recipient*. Mark a group as filterable to show it in the shop sidebar.

## Custom requests

Customers submit requests from **Custom order** (or **Request a quote** on quote-only products) with details, budget, deadline and up to 3 reference images (uploads can be switched off in Settings → Prices & checkout). Reference images are **private**: only staff can open them, through the dashboard.

In **Dashboard → Custom requests**, move each request through its stages: *New → In review → Quoted → Accepted → In progress → Completed* (or *Declined* or *Cancelled*). When you enter a **quote** (amount and message), the customer is emailed and sees it in their account.

A custom request is not an order. When the customer accepts, either create a quote-priced product for them or take payment through one of your manual methods and note it on the request.

## Messages (inquiries)

**Dashboard → Messages** collects the contact form and **Ask about this product** messages. Mark each one *In progress*, *Resolved* or *Spam*.

Customers who choose WhatsApp, Instagram or email are sent straight to that app. Those conversations happen there, not in the dashboard. Every one of these entry points tells the customer that a message is **not an order**.

## Reviews

Only signed-in customers with a verified email can write reviews, and only one per product. Reviews from people who bought the product are marked **Verified purchase**. Every review waits in **Dashboard → Reviews** until you approve it. You can approve, reject, feature or delete reviews.

Don't post reviews on customers' behalf, and don't invent reviews or testimonials. The **Customer reviews** homepage section shows approved reviews that you mark as featured, and stays hidden until there are some.

## Discounts

**Dashboard → Discounts**: percentage off (with an optional cap), a fixed amount off, or free delivery. Optional settings:
- minimum order
- start and end dates
- total usage limit (enforced even when two customers check out at the same moment)
- per-customer limit (by account or email)

Codes are case-insensitive.

## Content

- **Homepage:** reorder, show or hide, and edit sections: hero, category grid, product grids (bestsellers, new, featured, on sale, personalizable, one collection, one category, or hand-picked), featured collections, promo banner, how personalization works, craftsmanship, testimonials, Instagram link, newsletter. Sections can be scheduled with start and end dates (e.g. a Mother's Day banner).
- **Pages & policies:** Markdown editor. Raw HTML isn't rendered, for safety.
- **FAQ:** questions grouped by topic; draft entries start unpublished.
- **Newsletter:** subscribers with their consent record. Signups use double opt-in (a confirmation email) when email is configured. Export the list as CSV to send campaigns with an email marketing service (Mailchimp, Brevo…), include an unsubscribe link in every campaign, and mark people who unsubscribe there as unsubscribed here too.
- **Announcement bar** (Settings): a short message across the top of the site, with an optional link.

## Customers

**Dashboard → Customers** shows accounts with their orders and addresses. Customers can delete their own account from **Account → Security**. This removes their login, addresses, wishlist and cart and anonymizes their profile. Orders are kept (with the delivery details given at the time) for your accounting records. Decide how long to keep them, and say so in your privacy policy.

## Activity log

**Dashboard → Activity log** (Owner and Administrator) records staff sign-ins and failed sign-in attempts, settings changes, payment verifications, refunds, role changes and other admin actions, with who did them and when. IP addresses are stored only as pseudonymous hashes.
