# Architecture (for developers)

## Layout

```
prisma/
  schema.prisma          Data model (PostgreSQL)
  seed.ts                Initial store data, idempotent (no users, products or reviews)
  seed-content/          Policy page and FAQ templates
  demo-seed.ts, demo/    Optional sample catalog (SKUs DEMO-*)
scripts/                 create-admin, cleanup, remove-demo, migrate-deploy, backup.sh
src/
  proxy.ts               Per-request CSP nonce, early login redirect, no-store for private pages
                         (Next.js 16's name for middleware)
  instrumentation.ts     Production configuration check at server start
  app/
    (store)/             Storefront, auth and account pages
    admin/               Dashboard (every page calls requireStaffPage → 404 for non-staff)
    api/                 Uploads, private files, exports, search suggestions, health, cron
    media/[...key]/      Serves public images when no CDN URL is configured
    sitemap.ts, robots.ts, manifest.ts
  server/
    guard.ts             guarded(permission, fn) wrapper for admin actions
    actions/             Server Actions: public forms, auth, cart, checkout, account, orders
    actions/admin/       Admin Server Actions (each checks a permission)
  lib/                   Framework-independent domain logic (unit and integration tested)
    money.ts             Integer minor units, string parsing, no floats
    catalog/             Pricing, availability, badges, queries, product saving
    cart/                Server-side cart, totals
    checkout/            placeOrder: the single transactional order-creation path
    orders/              Status rules, admin and customer order operations
    payments/            Method rules, defaults, gateway provider registry (empty)
    discounts/           Discount evaluation
    auth/                Passwords, sessions, tokens, permissions, guards
    storage/             Local/S3 drivers, image processing (sharp), URLs
    settings/            Typed, validated, dashboard-editable settings
    content/             Homepage sections
    candle3d/            3D candle preview: config.ts (settings, choices → look; tested),
                         scene.ts (three.js drawing, loaded only in the browser on demand)
    email/               SMTP sending and templates
    rate-limit.ts, spam.ts, audit.ts, analytics.ts, maintenance.ts, csv.ts, text.ts
  components/            UI (ui/, store/, admin/, cart/, checkout/, account/, auth/)
tests/                   unit/, integration/, e2e/ (see docs/TESTING.md)
```

## Key rules and where they live

| Rule | Where |
|---|---|
| Money is always an integer number of minor units (cents). Display formatting uses the configured currency. | `lib/money.ts` |
| Prices, discounts, delivery, tax and surcharges are computed on the server only. | `lib/cart/totals.ts`, `lib/checkout/place-order.ts` |
| Order creation is one database transaction that does all of the following: <ul><li>re-validates the cart, stock, delivery area, payment method (including its required details) and discount</li><li>reserves stock with a conditional `UPDATE … WHERE stock >= qty`</li><li>increments discount usage atomically</li><li>snapshots product names, prices, personalization, the address and payment instructions</li><li>assigns `SG-<number>` from a sequence</li></ul> | `lib/checkout/place-order.ts` |
| Order (fulfillment) status and payment status are separate state machines. | `lib/orders/status.ts` |
| Only staff actions move a payment to `PAID` (`verifyPayment`), or a future gateway through `markPaidFromGateway` after server-to-server confirmation. | `lib/orders/service.ts` |
| Admin order actions lock the order row (`SELECT … FOR UPDATE`) and write an `OrderEvent` plus an `AuditLog` entry. | `lib/orders/service.ts` |
| Cancelling releases stock exactly once (checked through inventory movements). | `lib/orders/service.ts` |
| Every stock change writes an `InventoryMovement`. | `lib/orders/service.ts`, `lib/catalog/product-admin.ts` |
| Product listing fields (price range, in stock, rating) are denormalized and re-synced after every change. | `lib/catalog/sync.ts` |
| Permissions live in one map, and each admin action and route checks one. | `lib/auth/permissions.ts`, `server/guard.ts`, `lib/auth/guards.ts` |
| Settings are zod-validated JSON rows with safe defaults (no invented contact details). | `lib/settings/` |
| The 3D preview only shows choices; the purchase form is still what goes into the cart, and the server prices it as usual. three.js is downloaded only on product pages that have a 3D preview. | `lib/candle3d/`, `components/store/product/product-media.tsx` |

## Request flow

- **Pages** are Server Components and read data directly through `lib/`. Store pages use `force-dynamic`, because prices, stock and settings change from the dashboard and must show immediately.
- **Mutations** go through Server Actions. They validate with zod, check authorization, call `lib/` and `revalidatePath`. Forms use `useActionState`, so they work before JavaScript loads and show field-level errors.
- **Client components** are used only where interaction needs them: gallery, cart quantity controls, filters sheet, checkout form, uploader, dialogs.

## Adding things

- **A new setting:** add a field with a default to the zod schema in `lib/settings/schemas.ts`, then add the input to the matching form in `components/admin/settings-forms.tsx`. No migration is needed.
- **A new homepage section type:** add an enum value in `schema.prisma` (needs a migration), a config schema and description in `lib/content/home.ts`, a renderer in `components/store/home/sections.tsx`, and fields in `components/admin/home-section-form.tsx`.
- **A new payment gateway:** see [PAYMENTS.md](PAYMENTS.md#adding-an-online-payment-gateway-later).
- **A schema change:** edit `schema.prisma`, run `npm run db:migrate -- --name what-changed`, and commit the migration folder.
