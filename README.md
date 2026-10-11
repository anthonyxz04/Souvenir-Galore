# Souvenir Galore

The online store for Souvenir Galore, a Lebanese workshop that makes candles, personalized gifts, religious keepsakes, home décor and seasonal pieces by hand.

The site includes the storefront, customer accounts, a server-side cart and checkout, an order and payment workflow that a person must verify, custom-order requests and a role-based admin dashboard. Everything the owner needs to run the store is edited from the dashboard: products, the homepage, payment methods, delivery fees, contact details and policies.

> **Status: built, not yet launched.** The code is complete, but it needs real accounts (database, storage, email) and the owner's own content before launch. Start with [docs/GO_LIVE_CHECKLIST.md](docs/GO_LIVE_CHECKLIST.md). For what has and hasn't been tested, see [Verification status](#verification-status).

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Server Components, Server Actions) and TypeScript. Deploys to Netlify (see [docs/NETLIFY.md](docs/NETLIFY.md)), Vercel or Docker |
| Database | PostgreSQL 14+ through Prisma 6 |
| Images | Netlify Blobs on Netlify (no extra account), any S3-compatible storage (Cloudflare R2, AWS S3…), or the local disk on a single server. Images are resized to WebP when they're uploaded. |
| Email | Any SMTP provider (Resend, Postmark, Brevo, Amazon SES…) |
| Styling | Tailwind CSS v4, with self-hosted fonts (Marcellus and Figtree) |
| Tests | Vitest (unit and integration against a real Postgres) and Playwright (end-to-end, desktop and mobile) |

## Quick start (on your computer)

You need Node.js 22.12+ and a PostgreSQL database (see [docs/SETUP.md](docs/SETUP.md)).

```bash
npm install
npm run setup      # creates .env, the database tables, starting data, optional sample products and your owner account
npm run dev        # http://localhost:3000  ·  dashboard at http://localhost:3000/admin
```

`npm run setup` asks for your database connection string and your owner password. Nothing is hard-coded. The sample products have SKUs that start with `DEMO-` and are labelled as samples. Remove them any time with `npm run db:demo:remove`; the dashboard warns you while any remain.

## Documentation

| Document | What it covers |
|---|---|
| [SETUP.md](docs/SETUP.md) | Local setup, migrations, seeding, creating the first admin securely |
| [SERVICES.md](docs/SERVICES.md) | Every external account or service you need, and what each is for |
| [NETLIFY.md](docs/NETLIFY.md) | **Publishing on Netlify, step by step** (recommended for beginners) |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Vercel with managed Postgres and R2, or Docker on a VPS; environment variables; scheduled jobs |
| [ADMIN_GUIDE.md](docs/ADMIN_GUIDE.md) | Running the store day to day: orders, payments, products, custom requests, content |
| [PAYMENTS.md](docs/PAYMENTS.md) | Payment methods, the Whish Money manual workflow, verifying payments, adding a gateway later |
| [SECURITY.md](docs/SECURITY.md) | How accounts, roles, uploads, payments and data are protected |
| [BACKUP.md](docs/BACKUP.md) | Database and image backups, and how to restore |
| [TESTING.md](docs/TESTING.md) | How to run each test suite and what it covers |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Code layout and the main data and business rules, for developers |
| [GO_LIVE_CHECKLIST.md](docs/GO_LIVE_CHECKLIST.md) | Everything to finish and check before taking real orders |

## What's included

**Storefront**
- A homepage built entirely from dashboard-managed sections.
- Category and collection pages, plus a gift finder.
- Search with suggestions.
- Filters by occasion, recipient, budget, price, availability, color, material and other tags, with sorting and badges.
- Wishlist, recently viewed and related products.
- Product pages:
  - image gallery with zoom
  - variants
  - personalization fields with surcharges
  - making and preparation times
  - reviews from signed-in customers, each approved by staff before it appears; reviews from buyers are marked as verified purchases
  - share links
  - "ask about this product" by WhatsApp, Instagram or email, clearly labelled as an inquiry, not an order

**Checkout**
- The cart is stored on the server, for guests and for signed-in customers (it merges when a guest signs in).
- Discount codes.
- Delivery by area with fees, or pickup.
- Payment methods the owner chooses.
- Stock is reserved atomically, so two customers can't buy the last item at the same time.
- Order confirmation emails.
- Guests can track an order through a private link.
- An order is never shown as paid until a staff member has verified the payment.

**Customer accounts**
- Registration with email verification, login, and password reset.
- Profile and saved addresses.
- Order history, order tracking and cancellation requests.
- A saved cart and wishlist.
- Custom-order requests, with reference images and quotes.
- Account deletion.

**Admin dashboard**
- Products: variants, images, personalization, made-to-order and backorder settings, quote-only items, duplicate and archive.
- Inventory, with an adjustment log.
- Categories, collections and filter tags.
- Orders:
  - fulfillment status and payment status are tracked separately
  - every order has a full history and internal notes
  - each order can be printed as a sheet for packing
- Payment verification queue and refunds.
- Customers, custom requests and messages.
- Reviews, discounts, delivery and pickup.
- Payment methods: each one stays off until its required details are entered.
- Homepage editor, pages and policies, FAQ, newsletter.
- Staff roles and an activity log.
- Analytics that keep gross order value, verified sales, unpaid orders and refunds separate.

**Built-in protections**
- Role-based permissions are checked on the server for every action.
- CSRF protection on all forms and actions.
- A strict Content Security Policy.
- Rate limits on login, signup and public forms.
- Spam protection on public forms: a honeypot field, a timing check and optional Turnstile.
- Uploaded images are validated and re-encoded, which strips their metadata.
- Customer reference images are stored privately.
- An audit log of admin actions.
- No default admin account and no credentials in the code.

## Things the owner must provide

The code deliberately leaves these out, because they must come from the business:

- **Contact details:** WhatsApp number, Instagram handle, email and phone. Each contact button stays hidden until its detail is entered.
- **Payment details:** the Whish account, bank details, which payment methods to offer. All methods start **disabled**.
- **Delivery:** fees and delivery times for each area. All areas start **inactive**.
- **Policies:** the delivery, returns, privacy and terms pages are drafts with `[placeholders]`. They're flagged "Needs owner review" until the owner edits and approves them.
- **Products, photos, the brand story and real customer reviews.** The store ships with no products, testimonials or reviews.

## Verification status

The code was written in an environment where the npm registry was blocked, so the project's own dependencies couldn't be installed there.

| Check | Result |
|---|---|
| Unit tests (money, pricing, totals, discounts, payment rules, order status, permissions, personalization, images, text) | ✅ **110 passed, 0 failed** (run with Bun's test runner; they're written for Vitest) |
| TypeScript, strict, whole project | ✅ **0 errors** (real React, Node and sharp types; Prisma types generated from the schema; Next.js and a few UI packages stubbed) |
| Raw SQL (order numbering, discount limit, rate limiting, analytics) | ✅ Run against PostgreSQL 16 |
| Backup script, plus restoring its dump | ✅ Run against PostgreSQL 16 |
| Netlify Blobs photo storage | ✅ Tested with the real client library against a local stand-in for the service |
| `docker-compose.yml` | ✅ Validated with `docker compose config` |
| `next build`, integration tests, Playwright end-to-end tests | ❌ **Not run yet.** They need the real packages. |

[docs/TESTING.md](docs/TESTING.md#verification-status-of-this-codebase) has the exact commands. Run them on a machine with normal internet access before going live.

## Scripts

| Command | Purpose |
|---|---|
| `npm run setup` | One-time local setup (env file, tables, starting data, sample products, owner account) |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run typecheck` | TypeScript check |
| `npm run db:migrate` | Create and apply a migration (development) |
| `npm run db:deploy` | Apply migrations (production) |
| `npm run db:seed` | Initial store data (safe to re-run) |
| `npm run admin:create` | Create the owner account, or promote an existing account |
| `npm run db:demo` / `npm run db:demo:remove` | Add or remove the sample catalog |
| `npm run maintenance:cleanup` | Daily housekeeping (expired sessions, abandoned guest carts, unused images) |
| `npm run backup` | Database (and local images) backup to `./backups` |
| `npm test` | Unit tests |
| `npm run test:integration` | Integration tests (needs `TEST_DATABASE_URL`) |
| `npm run test:e2e` | End-to-end tests (needs `TEST_DATABASE_URL`) |
