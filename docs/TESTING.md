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

### Unit: `tests/unit`

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
| `settings-and-text.test.ts` | Safe settings defaults (**no contact details invented**, USD, tax and pickup off); slugs; safe links; Instagram links and Lebanese WhatsApp numbers cleaned up |
| `candle3d.test.ts` | 3D preview settings: safe defaults, linking choices to candle parts, the candle following choices and typed text (dates as day.month.year), suggested colors and sizes, links to removed choices cleared |

### Integration: `tests/integration` (real PostgreSQL)

| File | What it checks |
|---|---|
| `checkout.test.ts` | Server-side totals and order numbers; manual payments start as *awaiting payment*; **overselling prevented when customers race for the last item**; backorders; disabled or incomplete payment methods refused; inactive delivery areas; changed totals refused; personalization stored and charged; **discount usage limit holds under concurrency**; minimum order |
| `orders.test.ts` | **A customer's payment reference only moves the order under review; only staff verification marks it paid and is recorded**; rejection; cancellation returns stock once, voids payment and frees the discount; invalid transitions refused; partial and full refunds; gateway confirmations must match the total exactly and are idempotent |
| `auth.test.ts` | Hash-only password storage; duplicate emails; disabled accounts; single-use expiring tokens; reset ends all sessions; database-backed rate limits; account deletion keeps orders but removes personal data |
| `products.test.ts` | Saving products and variants; validation; duplicate SKUs; stock changes only through logged adjustments; duplicating as a draft; **personalization fields added in the editor are kept**; 3D settings saved in step with the options; the sample candle's 3D setup |
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
| `customizer.spec.ts` | **3D candle customizer:** the owner adds a candle with an option and a personalization field, turns on the 3D preview, links options automatically and sets a color (the editor's live preview draws); the settings persist. A customer sees the candle follow their jar color and typed name, turns it, adds it to the cart, and the cart shows their choices. Products without 3D keep the photo gallery. |
| `mobile.spec.ts` | Mobile menu (including the logo); no sideways scrolling on key pages; filter sheet; touch-target sizes |

Playwright builds the app (`npm run build`) and starts it on port 3100, using local file storage in `./storage-e2e`. If a test fails, traces and screenshots are kept in `test-results/`; open them with `npx playwright show-trace`.

## Verification status of this codebase

Every push to GitHub runs the full suite with the real packages (Next.js 16, Prisma 6, Vitest, Playwright) and a real PostgreSQL 16 database. See the **Actions** tab of the repository for the latest results.

| Check | Where it runs |
|---|---|
| Unit tests | GitHub Actions (`npm test`) |
| Type check | GitHub Actions (`npm run typecheck`) |
| Production build | GitHub Actions (`npm run build`) |
| Netlify Database migrations | GitHub Actions: applied to an empty PostgreSQL 16 database, then `prisma migrate diff` confirms they match `prisma/schema.prisma` exactly |
| Integration tests | GitHub Actions, against PostgreSQL 16 |
| End-to-end tests | GitHub Actions, Chromium (desktop and mobile) against a production build |
| Live site | **Actions → Live site check → Run workflow** (`scripts/live-check.mjs`): read-only checks of the production site in Chromium (database health, every main page on phone and desktop, internal links, icons, SEO files, security headers, admin/account protection). Results and screenshots are saved to the `live-check-results` branch. |

When a CI check fails, the workflow posts the end of the failing log (and, for browser tests, a snapshot of the page) as a comment on the commit.

Also checked by hand during development: `scripts/backup.sh` (backup and restore round trip on PostgreSQL 16) and `docker compose config`.

## Continuous integration

`.github/workflows/ci.yml` runs everything on GitHub's servers on every push: unit tests, the type check, the production build, the migration check, integration tests against a PostgreSQL 16 service, and the Playwright journeys. Every check runs even if an earlier one fails, so one run shows every problem. Results appear under **Actions**.
