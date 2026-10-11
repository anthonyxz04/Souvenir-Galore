# Go-live checklist

Work through this list before taking real orders. Items marked **Owner** need decisions or information only the business can provide. Items marked **Developer** are technical.

## 1. Verify the code (Developer)

- [ ] `npm install` on a machine with internet access; commit `package-lock.json`.
- [ ] `npx prisma migrate dev --name init`; commit `prisma/migrations/`.
- [ ] `npm run typecheck` passes.
- [ ] `npm test` passes.
- [ ] `npm run test:integration` passes against a throwaway test database.
- [ ] `npm run test:e2e` passes.
- [ ] `npm run build` succeeds.
- [ ] `npm audit` reviewed.

See [TESTING.md](TESTING.md#verification-status-of-this-codebase) for why these must be run.

## 2. Accounts and hosting (Owner and Developer)

- [ ] Domain registered, DNS access available.
- [ ] Hosting set up (Vercel Pro, or a VPS with Docker). See [DEPLOYMENT.md](DEPLOYMENT.md).
- [ ] Managed PostgreSQL with **automatic backups and point-in-time restore** turned on.
- [ ] Object storage: **public** bucket with a CDN or custom domain, plus a **private** bucket for customer uploads.
- [ ] SMTP provider set up with the domain verified (SPF, DKIM and DMARC records added).
- [ ] All environment variables set in production. Copies of the secrets are kept in a password manager.
- [ ] `APP_URL` is the final `https://` domain; HTTPS works; `www` redirects to the main domain (or the reverse).
- [ ] `TRUST_PROXY=true` behind the host or proxy.
- [ ] Repository is **private**; `.env` has never been committed (`git log --all -- .env` shows nothing).

## 3. First run (Developer)

- [ ] Migrations applied (`npm run db:deploy`, or automatically on deploy or start).
- [ ] `npm run db:seed` run once.
- [ ] Owner account created with `npm run admin:create`, using a strong, unique password.
- [ ] `https://yourdomain.com/api/health` returns `{"ok":true}`; uptime monitor added.
- [ ] Daily cleanup scheduled (Vercel cron with `CRON_SECRET`, or a crontab on the server).
- [ ] Off-site database backups scheduled; **one restore tested** ([BACKUP.md](BACKUP.md)).
- [ ] Demo products removed (`npm run db:demo:remove`) if they were ever added. The dashboard shows a red warning while any remain.

## 4. Store settings (Owner)

- [ ] **Settings → Business:** store name, description, logo.
- [ ] **Settings → Contact & social:** real email, phone, WhatsApp (international format) and Instagram username. Test each button on a product page.
- [ ] **Settings → Prices & checkout:**
  - [ ] currency confirmed
  - [ ] tax setting decided (none, included or added) with an accountant's advice
  - [ ] minimum order and free-delivery threshold set
  - [ ] guest checkout on or off
  - [ ] gift-finder price bands set
- [ ] **Delivery & pickup:**
  - [ ] real fee and delivery time for each area, with only the areas you serve switched **on**
  - [ ] pickup address and hours, if offered
- [ ] **Payments:**
  - [ ] Decide which methods to offer.
  - [ ] Cash on delivery: enable if offered.
  - [ ] Whish Money: real account holder, number and instructions entered and **double-checked**, then enabled.
  - [ ] Bank transfer: details and instructions, if offered.
  - [ ] At least one method enabled.
- [ ] `ADMIN_NOTIFICATION_EMAILS` set to the inbox that handles orders.
- [ ] **Settings → Search engines:** default title, description and social sharing image.

## 5. Content (Owner)

- [ ] **Every policy page reviewed** (delivery and pickup, returns and refunds, custom orders, privacy, terms):
  - [ ] all `[placeholders]` replaced
  - [ ] wording matches how the business really works
  - [ ] "Needs owner review" unticked
- [ ] Privacy policy and terms checked by a **qualified legal professional** for Lebanese law, including Law No. 81/2018, and for any other countries you sell to.
- [ ] **About** page written with your real story. Don't make claims you can't back up (awards, years in business, "best in Lebanon", and so on).
- [ ] **FAQ** reviewed and published.
- [ ] **Homepage:**
  - [ ] hero image and text
  - [ ] Craftsmanship section written and shown, or left hidden
  - [ ] sections ordered
- [ ] Collections you want to show published (Wedding season, Christmas, …).

## 6. Catalog (Owner)

- [ ] Real products added with:
  - [ ] photos and alt text
  - [ ] accurate descriptions
  - [ ] prices, and stock or made-to-order settings
  - [ ] making times
  - [ ] personalization fields with correct surcharges and character limits
- [ ] Categories and tags checked; filters show sensible options.
- [ ] Quote-only products set up for bespoke work.
- [ ] No placeholder or sample content left anywhere.

## 7. End-to-end trial on the live site (Owner and Developer)

- [ ] Register a customer account: the verification email arrives and isn't in spam.
- [ ] Password reset email arrives and works.
- [ ] Place an order with **cash on delivery**:
  - [ ] the confirmation page and email say it's unpaid
  - [ ] the order appears in the dashboard
  - [ ] the admin notification email arrives
- [ ] Place an order with **Whish Money**:
  - [ ] the instructions show the correct number
  - [ ] submit a reference, and the order shows "under review", not paid
  - [ ] verify it in the dashboard; the customer gets a "payment received" email
  - [ ] reject one as well, and check that the customer can resubmit
- [ ] Move an order through every status; the customer emails and the tracking page update.
- [ ] Cancel an order; stock returns.
- [ ] Record a refund on a paid order; the analytics show it under refunds.
- [ ] Submit a **custom request** with a photo; staff can open the photo and send a quote.
- [ ] Send a WhatsApp, Instagram and email inquiry from a product page.
- [ ] Try a discount code, including when it has expired or is used up.
- [ ] Test on a phone: menu, filters, product page, checkout.
- [ ] Delete the test orders' customer account (or keep it for future testing), and archive any test products.

## 8. Ongoing

- [ ] Someone checks **Payments to verify** and **Orders to confirm** daily.
- [ ] Monthly: `npm audit` and dependency updates. Quarterly: a backup restore test.
- [ ] Staff accounts reviewed whenever someone joins or leaves.
