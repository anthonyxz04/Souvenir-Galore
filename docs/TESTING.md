# Testing

There are three test suites, from fastest to most complete:

| Suite | Tool | Needs | Command |
|---|---|---|---|
| **Unit** (business rules, no database) | Vitest | Nothing | `npm test` |
| **Integration** (real database: checkout, orders, payments, accounts, products, seed, cleanup) | Vitest | A **separate** PostgreSQL database in `TEST_DATABASE_URL` | `npm run test:integration` |
| **End-to-end** (real browser against a production build) | Playwright | `TEST_DATABASE_URL`, plus Chromium (`npx playwright install chromium`) | `npm run test:e2e` |

Run everything with `npm run test:all`. Also run `npm run typecheck` and `npm run build` before each release.

> ⚠️ **`TEST_DATABASE_URL` is wiped** at the start of the integration and end-to-end runs (`prisma db push --force-reset`). Never point it at a database with real data. Create one just for tests:
> ```bash
> createdb souvenir_galore_test
> export TEST_DATABASE_URL="postgresql://user:pass@localhost:5432/souvenir_galore_test?schema=public"
> ```

## What each suite covers

### Unit: `tests/unit` (110 tests)

| File | What it checks |
|---|---|
| `money.test.ts` | Parsing and formatting money in minor units with no floating-point errors; zero-decimal currencies; rounding |
| `pricing.test.ts` | Sale windows; price ranges; stock, low-stock and backorder availability; made-to-order capacity; badges; variant combinations; making-time labels |
| `totals.test.ts` | Line totals with personalization surcharges; delivery fees; the free-delivery threshold after discounts; discount caps; tax included or added |
| `discounts.test.ts` | Validity dates, usage and per-customer limits, minimum spend, rounding, never exceeding the subtotal |
| `payments.test.ts` | **All methods disabled by default; Whish Money blocked until its details are entered; no invented account details; never starting an order as paid**; gateways refused without an installed integration |
| `order-status.test.ts` | Allowed status changes for delivery and pickup; payment review, verification, rejection and refund transitions; when customers may submit references or request cancellation |
| `personalization.test.ts` | Required fields, length limits, real dates, allowed options, surcharges only on filled fields, input sanitizing |
| `auth.test.ts` | Password hashing and policy; **role permissions** (customers get no admin access, staff are limited, only owners manage staff); token generation; IP pseudonymization; open-redirect prevention |
| `images.test.ts` | WebP renditions, metadata stripping, rejection of non-images, SVG, undecodable and too-small images |
| `settings-and-text.test.ts` | Safe settings defaults (**no contact details invented**, USD, tax and pickup off); slugs; safe links |

### Integration: `tests/integration` (real PostgreSQL)

| File | What it checks |
|---|---|
| `checkout.test.ts` | Server-side totals and order numbers; manual payments start as *awaiting payment*; **overselling prevented when customers race for the last item**; backorders; disabled or incomplete payment methods refused; inactive delivery areas; changed totals refused; personalization stored and charged; **discount usage limit holds under concurrency**; minimum order |
| `orders.test.ts` | **A customer's payment reference only moves the order under review; only staff verification marks it paid and is recorded**; rejection; cancellation returns stock once, voids payment and frees the discount; invalid transitions refused; partial and full refunds; gateway confirmations must match the total exactly and are idempotent |
| `auth.test.ts` | Hash-only password storage; duplicate emails; disabled accounts; single-use expiring tokens; reset ends all sessions; database-backed rate limits; account deletion keeps orders but removes personal data |
| `products.test.ts` | Saving products and variants; validation; duplicate SKUs; stock changes only through logged adjustments; duplicating as a draft |
| `seed.test.ts` | The seed creates every payment method **switched off**, delivery areas inactive, **no admin, no products, no reviews**, policy pages flagged for review; safe to run twice |
| `maintenance.test.ts` | Daily cleanup removes only expired or abandoned records |

### End-to-end: `tests/e2e` (Chromium, desktop and mobile)

The global setup resets the test database, seeds it, creates a test owner account, and turns on one delivery area, cash on delivery and pickup.

| File | What it checks |
|---|---|
| `storefront.spec.ts` | Homepage; shop filters; search; product structured data and personalization pricing; **guest checkout with cash on delivery creates an order that is not paid**; empty-cart guard; security headers (CSP and others); **branding: tab title "Souvenir Galore", favicon, home-screen icon, manifest and sharing image are served** |
| `accounts.spec.ts` | Registration and sign-out; generic login errors; password reset doesn't reveal accounts; signed-in checkout and order history; **customers get 404 on `/admin`** |
| `admin.spec.ts` | Dashboard wording; **Whish Money can't be enabled until its details are filled in**; creating a category and a product with an image; recording a cash payment; uploads from other origins rejected |
| `journeys.spec.ts` | The owner's acceptance checklist: <ul><li>hero, category, product, footer and menu links open real pages</li><li>cart add, quantity change (persists after reload) and remove, with correct totals</li><li>discount codes checked against the database (invalid code rejected; 10% applied)</li><li>wishlist save and remove</li><li>order appears in the customer's history; **another customer gets 404 on it**; the admin updates the status and the customer sees it</li><li>custom-order request saved and visible in the dashboard</li><li>**admin adds a candle with a photo, publishes it, edits the price, and it persists in the shop; deletes a product and it's gone**</li><li>contact details from settings drive the WhatsApp, Instagram and email buttons</li></ul> |
| `mobile.spec.ts` | Mobile menu (including the logo); no sideways scrolling on key pages; filter sheet; touch-target sizes |

Playwright builds the app (`npm run build`) and starts it on port 3100, using local file storage in `./storage-e2e`. If a test fails, traces and screenshots are kept in `test-results/`; open them with `npx playwright show-trace`.

## Verification status of this codebase

The code was written in an environment where the npm registry was blocked, so the project's dependencies (Next.js, Prisma, Vitest, Playwright and others) couldn't be installed there. This is exactly what was and wasn't executed:

| Check | Status | Details |
|---|---|---|
| Unit tests | ✅ **Executed: 110 passed, 0 failed** | Run with Bun's test runner, which is compatible with these Vitest-style tests, not with Vitest itself. Includes the real sharp image pipeline. |
| TypeScript | ✅ **Executed: 0 errors**, including a strict mode where database query results are typed exactly as Prisma types them (only the selected fields) | Whole project (app, scripts, tests) under `strict`. It used real type definitions for React, Node and sharp, and Prisma types generated from `schema.prisma`; Next.js, Radix and a few other packages were replaced by stubs. Run `npm run typecheck` with the real packages to confirm. |
| Raw SQL statements | ✅ **Executed** | Order numbering, the atomic discount counter, the rate-limit upsert and the analytics query were run against PostgreSQL 16. |
| Backup and restore script | ✅ **Executed** | `scripts/backup.sh` backed up a PostgreSQL 16 database, and the dump was restored into an empty database and compared. |
| Storefront rendering | ✅ **Rendered in Chromium** | The real header, homepage sections, 12 product pages, mobile menu markup and footer were rendered with sample data and the real Tailwind styles. There was no horizontal scrolling at phone or desktop widths and no console errors. Interactive behaviour (cart, forms, menus) wasn't exercised, because that needs the full app running. |
| Netlify Blobs photo storage | ✅ **Executed** | The storage code ran with the real `@netlify/blobs` client library against a local stand-in for the Blobs service: write, read back, private/public separation, missing files, deletion and unsafe-key rejection. A real Netlify deploy hasn't happened yet. |
| `docker-compose.yml` | ✅ Validated with `docker compose config` | The image itself wasn't built, because that needs the npm registry. |
| `next build` | ❌ **Not executed** | Needs the real dependencies. |
| Integration tests | ❌ **Not executed** | Need the Prisma client (the npm registry was blocked). |
| End-to-end tests | ❌ **Not executed** | Need Next.js and Playwright's test runner. |
| Initial migration | ❌ Not generated | Run `npx prisma migrate dev --name init` (see [SETUP.md](SETUP.md)). |

**Before going live, on a machine with normal internet access:**

```bash
npm install
npx prisma migrate dev --name init      # creates and commits the initial migration
npm run typecheck
npm test
TEST_DATABASE_URL=postgresql://…/souvenir_galore_test npm run test:integration
npx playwright install chromium
TEST_DATABASE_URL=postgresql://…/souvenir_galore_test npm run test:e2e
npm run build
```

Fix anything that fails before taking real orders. Expect a small number of adjustments the first time, because these suites haven't yet run against the real packages.

## Continuous integration

`.github/workflows/ci.yml` runs everything on GitHub's servers on every push: unit tests, the production build, the type check, integration tests against a PostgreSQL 16 service, and the Playwright journeys. Push the project to a GitHub repository and the results appear under **Actions**.
