# Go-live checklist

Work through this list before taking real orders. Items marked **Owner** need decisions or information only the business can provide. Items marked **Developer** are technical.

## 1. Verify the code (Developer)

GitHub Actions runs all of these on every push (see [TESTING.md](TESTING.md#verification-status-of-this-codebase)). Check that the latest run on `main` is green:

- [ ] Unit tests, type check and production build pass.
- [ ] Netlify Database migrations match `prisma/schema.prisma`.
- [ ] Integration tests (real PostgreSQL) pass.
- [ ] End-to-end tests (Chromium) pass.
- [ ] **Live site check** (Actions → Live site check → Run workflow) passes against the production address.
- [ ] `npm audit` reviewed.

## 2. Hosting (Netlify)

See [NETLIFY.md](NETLIFY.md).

- [ ] The Netlify project is linked to the GitHub repository; pushes to `main` publish the site.
- [ ] `APP_SECRET`, `CRON_SECRET` and `SETUP_TOKEN` are set as **secret** values for Production, and `STORAGE_DRIVER=netlify` is set. Copies are kept in a password manager.
- [ ] Visitor access: team-login protection is **off** for production.
- [ ] Netlify Database is active (Data & Storage → Database), and credit usage is checked under Team settings → Billing.
- [ ] SMTP provider set up with the domain verified (SPF, DKIM and DMARC records added), and the `SMTP_*` variables set.
- [ ] Optional: your own domain added under Domain management (HTTPS is automatic), then one redeploy.
- [ ] `.env` has never been committed (`git log --all -- .env` shows nothing). The repository can be public because it contains no secrets, but making it private is a good habit.

## 3. First run

- [ ] Owner account created from the one-time link `https://<your-site>/setup-owner?token=<SETUP_TOKEN>`, with a strong, unique password. Then delete `SETUP_TOKEN` in Netlify.
- [ ] `https://<your-site>/api/health` returns `{"ok":true}`; uptime monitor added.
- [ ] Daily cleanup: `netlify/functions/daily-cleanup.mts` runs automatically once `CRON_SECRET` is set. Check its log under Logs → Functions the day after launch.
- [ ] Backups: take a database snapshot before big changes (Data & Storage → Database). For off-site copies, see [BACKUP.md](BACKUP.md).
- [ ] Sample products removed (Dashboard → **Remove sample products**) if they were ever added. The dashboard shows a red warning while any remain.

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
