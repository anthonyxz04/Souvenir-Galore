# Security

This document describes how the store protects accounts, customer data and payments, what the owner must do, and what to do if something goes wrong.

## Secrets and credentials

- **No credentials are in the code or the repository.** `.env` and `.env.*` are git-ignored, and `.env.example` contains only placeholders.
- **There is no default administrator and no default password.** The first owner is created from the command line with `npm run admin:create`, with a password the owner chooses that must pass the password policy. See [SETUP.md](SETUP.md#5-create-the-first-administrator-owner).
- **Secrets live only in environment variables** on the server or hosting provider: the database URL, `APP_SECRET`, storage keys, SMTP password, Turnstile secret and `CRON_SECRET`.
- In production, the server **refuses to start** without `DATABASE_URL` or a 32+ character `APP_SECRET`. It logs warnings for other risky settings (`src/instrumentation.ts`).
- Only `NEXT_PUBLIC_*` variables reach the browser, and those hold only public identifiers (the Turnstile site key and analytics IDs).
- Payment details customers need to pay (the Whish number, bank details) are entered by the owner in the dashboard. They are deliberately public to customers who choose that method. No payment API secrets exist in the system.

## Accounts and sessions

| Protection | Details |
|---|---|
| Password storage | scrypt (N=2¹⁶, r=8, p=2) with a random salt per password. Hashes are upgraded automatically when the parameters change. |
| Password policy | 10–128 characters, not a common password, not a single repeated character, not containing the email name. |
| Sessions | A random 256-bit token in an **httpOnly, Secure, SameSite=Lax** cookie with the `__Host-` prefix whenever the site runs on HTTPS (`APP_URL` starts with `https://`). Only a SHA-256 hash of the token is stored, so a database leak doesn't expose usable sessions. |
| Session lifetime | 30 days for customers and **7 days for staff**, extended while in use. |
| Revocation | A password reset signs out every device. A password change signs out every other device. Changing a staff member's role or disabling an account signs them out. Deleting an account removes all its sessions. |
| Email verification and password reset | Single-use tokens, stored hashed, with expiry: 1 hour for resets. Reset requests always give the same answer, so they can't be used to find out which emails have accounts. |
| Login | Generic "email or password is incorrect" message. A dummy hash is checked for unknown emails so response times don't reveal which accounts exist. Rate-limited per IP address and per account. Failed sign-in attempts are recorded in the activity log. |
| Staff access | Can only be granted to accounts with a verified email. |

**Owner action:** use a unique, generated password stored in a password manager for every staff account. The dashboard doesn't support two-factor authentication yet, so strong passwords matter. Remove staff access as soon as someone leaves.

## Authorization

- **Roles:** Customer, Staff, Administrator and Owner, with an explicit permission map in `src/lib/auth/permissions.ts`, covered by unit tests.
- **Every** admin server action and admin API route checks a permission **on the server** (`guarded()`, `assertPermission`). Hiding a button is never the only protection.
- Admin pages respond with **404 Not Found** to anyone without staff access, and admin routes are excluded from search engines (`robots.txt`, `noindex`).
- Customers can only see their own orders, addresses, requests and wishlist. Guests reach their order only through an unguessable private link; only its hash is stored.
- Only Owners can grant or remove staff roles, and the last owner can't be removed.

## Requests and pages

- **CSRF:**
  - Every form uses Next.js Server Actions, which reject requests whose `Origin` doesn't match the site.
  - Admin API routes that change data check the origin as well.
  - Cookies are `SameSite=Lax`.
- **Content Security Policy:**
  - A per-request **nonce** with `strict-dynamic`, so no inline scripts can run unless the server rendered them.
  - `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`.
  - External origins (the image CDN, Turnstile, analytics) are allowed only when configured (`src/proxy.ts`).
- **Other headers:**
  - HSTS (production)
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - a strict `Referrer-Policy`
  - a restrictive `Permissions-Policy`
  - `Cross-Origin-Opener-Policy`
  - no `X-Powered-By`
- **Caching:** account, checkout and admin pages are sent with `Cache-Control: no-store`.
- **Input validation:**
  - Every form and action is validated on the server with zod.
  - Prices, totals, discounts, delivery fees and personalization surcharges are **always recalculated on the server**. Prices sent by the browser are ignored, and the order is refused if the total changed since the customer last saw it.
- **Database:** all queries go through Prisma or parameterized tagged-template SQL. No query is built from strings.
- **Output:**
  - Markdown content is rendered with raw HTML disabled.
  - Admin-entered links are restricted to `http(s)`, `mailto` or site paths.
  - Login redirects only go to paths on the same site (no open redirects).
  - CSV exports neutralize spreadsheet formulas.

## Uploads

- Image uploads are limited in size (`UPLOAD_MAX_MB`) and count, and are rate-limited.
- Every file is **decoded and re-encoded** with sharp. Files that aren't real JPEG, PNG, WebP or AVIF images are rejected whatever their name or type claims. **SVG is never accepted.** Location and camera metadata are removed.
- Files get random names, and storage keys are validated against a strict pattern (no path traversal).
- **Customer reference images are private.** They go to a private bucket or folder, are never reachable by URL, and are streamed only to staff with the right permission, with `no-store` and a sandboxing CSP.
- Public images are served with `nosniff` and `Content-Security-Policy: default-src 'none'; sandbox`.

## Payments

- No order is ever created as paid. Only staff with payment permission can mark a payment received, and a customer's "I paid" only puts the payment under review. See [PAYMENTS.md](PAYMENTS.md).
- Payment methods can't be enabled until their required details are entered, and checkout re-checks this on every order.
- Every payment action is recorded with who did it and when (payment records, order history, activity log).
- Stock reservation and discount usage limits are enforced atomically in the database, so racing checkouts can't oversell or overuse a code (covered by integration tests).

## Abuse protection

| Limit | Default |
|---|---|
| Sign-in | 20 per 15 min per IP; 6 per 15 min per account |
| Registration | 5 per hour per IP |
| Password reset | 10 per hour per IP; 3 per hour per account |
| Verification emails | 3 per hour per account |
| Public forms (contact, product questions, custom orders) | 6 per 10 min per IP |
| Newsletter signup | 5 per hour per IP |
| Reviews | 5 per day per account |
| Payment reference submissions | 8 per hour per IP |
| Discount code attempts | 20 per 10 min per IP |
| Admin uploads | 120 per 10 min per user |
| Search suggestions | 120 per minute per IP |

Limits are stored in the database, so they hold across server instances (`src/lib/rate-limit.ts`). Public forms also use a hidden honeypot field, a minimum fill-in time and, when configured, Cloudflare Turnstile.

## Privacy

- IP addresses are never stored in plain form. Rate limits and audit entries use a keyed hash (HMAC with `APP_SECRET`).
- **Cookies:**
  - the session cookie (only after sign-in)
  - the guest cart cookie
  - the analytics consent choice
  - Google Analytics cookies, only after the visitor accepts
  - Plausible, if used, sets no cookies
- **Account deletion:** customers can delete their account themselves (**Account → Security**). This removes their login, addresses, wishlist, cart and newsletter subscription, and anonymizes their profile and reviews. Order records are kept for accounting. Set your retention period in the privacy policy.
- The privacy policy template mentions Lebanon's Law No. 81 of 2018 on electronic transactions and personal data. **Have it reviewed by a qualified professional** for your actual practices.

## Audit log

**Dashboard → Activity log** records:
- staff sign-ins and failed sign-ins
- role changes
- settings and payment-method changes
- payment verifications, rejections and refunds
- order status changes
- product deletions
- exports
- other admin actions

Each entry has the actor, time, affected record and a pseudonymous IP hash. Sensitive fields such as passwords and tokens are removed from logged details automatically.

## Keeping it secure

- **Dependencies:**
  - Run `npm audit` regularly.
  - Enable Dependabot or Renovate on the repository.
  - Update Next.js promptly when security releases come out.
- **Database:** use TLS (`sslmode=require`) and a user that only has access to this database.
- **Server (Docker option):** keep it updated, firewall everything except SSH, HTTP and HTTPS, and don't expose PostgreSQL. The included `docker-compose.yml` doesn't.
- **Backups:** encrypt off-site backups or keep them in a private bucket. They contain personal data.
- **Restore test:** test restoring every quarter ([BACKUP.md](BACKUP.md)).

## If a secret leaks

| Secret | Do this |
|---|---|
| Database password | Rotate it with the provider, then update `DATABASE_URL` / `MIGRATE_DATABASE_URL` and redeploy. Review the activity log and recent orders. |
| `APP_SECRET` | Generate a new one and redeploy. Rate-limit counters reset, and old IP hashes no longer link to new ones. Sessions and passwords are unaffected. |
| Storage keys | Revoke the API token, create a new one restricted to the two buckets, and update `S3_*`. |
| SMTP password | Rotate it with the provider and update `SMTP_PASSWORD`. |
| A staff password | Reset it. Resetting signs out every device. Check **Activity log** for actions taken with the account. |
| Customer data exposure | Contain the issue, preserve logs, and get legal advice on your notification obligations under Lebanese law and the laws of affected customers' countries. |

## Known limitations

- No two-factor authentication for staff yet. This is a recommended future addition.
- No customer self-service data export. Provide it on request from the dashboard (customer and order pages, and the CSV export).
- Turnstile is optional. Without it, public forms rely on the honeypot, the timing check and rate limits.

## Reporting a vulnerability

Send security reports privately to the store owner's email address (see **Contact** on the site), not as public issues.
