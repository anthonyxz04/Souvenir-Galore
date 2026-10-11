# Services and accounts you need

This is every outside service the store relies on, what each one is for, and whether it's required. Each service is a separate account in the business's name, and its credentials go only into the hosting provider's environment variables, never into the code.

Prices and free-tier limits change often, so check each provider's current pricing page before signing up.

## Required

| Service | What it's for | Suggested providers | Notes |
|---|---|---|---|
| **Domain name** | The store's address, e.g. `souvenirgalore.com` | Any registrar (Cloudflare Registrar, Namecheap, Gandi…) | You also need DNS access to set up email sending (SPF, DKIM and DMARC records). |
| **Web hosting** | Runs the Next.js app | **Vercel** (simplest), or a VPS with Docker (Hetzner, DigitalOcean, OVH…), or Railway or Render | Vercel's free "Hobby" plan is for non-commercial use, so check its current terms; a shop normally needs the Pro plan. A small VPS with the included `docker-compose.yml` is the lower-cost alternative, but you look after the server yourself. |
| **PostgreSQL database** | All store data: products, orders, customers, settings | **Neon**, **Supabase**, Railway, or a managed Postgres from your VPS provider | Choose a plan with **automatic daily backups and point-in-time recovery**. Use a region close to your hosting. |
| **Object storage** (S3-compatible) | Product photos and customers' reference images | **Cloudflare R2** (no fees for downloads), AWS S3, Backblaze B2 | You need **two buckets**: a public one for product images and a **private** one for customer uploads. On a single VPS you can use local disk storage instead, but then you must back up the folder (see [BACKUP.md](BACKUP.md)). |
| **Transactional email (SMTP)** | Email verification, password resets, order confirmations, status updates, notifications to the owner | **Resend**, **Postmark**, Brevo, Amazon SES | Verify your domain with the provider and add the DNS records it gives you, or emails will land in spam. Use an address like `orders@yourdomain.com`. |

## Business accounts (the owner's own)

| Account | Why | Where it's used |
|---|---|---|
| **Whish Money account** | To receive Whish transfers from customers | Dashboard → Payments → Whish Money. Enter the account holder, account number and instructions, then enable it. It stays disabled until then. |
| **Bank account** (optional) | For bank transfers | Dashboard → Payments → Bank transfer |
| **WhatsApp number** (WhatsApp Business is recommended) | For "Ask on WhatsApp" buttons and the chat bubble | Dashboard → Settings → Contact |
| **Instagram account** | For the Instagram link and "Message us on Instagram" | Dashboard → Settings → Contact |
| **Store email inbox** | Receives order notifications and replies to customers | Settings → Contact, and `ADMIN_NOTIFICATION_EMAILS` |

Every contact button stays hidden until the owner enters the matching detail.

## Optional

| Service | What it adds | Notes |
|---|---|---|
| **Cloudflare Turnstile** | An extra, privacy-friendly bot check on public forms (signup, contact, product questions, custom orders, newsletter) | Free. Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`. Without it, forms still use a honeypot field, a timing check and rate limits. |
| **Plausible Analytics** | Visitor statistics without cookies, so no consent banner is needed | Paid. Set `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`. |
| **Google Analytics 4** | Visitor statistics | Free. It uses cookies, so it only loads after a visitor accepts the consent banner. Set `NEXT_PUBLIC_GA_MEASUREMENT_ID`. |
| **Uptime monitoring** | Alerts you if the site goes down | UptimeRobot, Better Stack and similar. Monitor `https://yourdomain.com/api/health`, which returns `{"ok":true}` when the app can reach the database. |
| **Error monitoring** | Alerts you about server errors | Not built in. Sentry or a similar tool can be added by a developer. |
| **Online card or wallet payments** | Automatic payments at checkout | Not active. This needs a merchant agreement with a provider that offers an official API for your business, plus a developer to add it. See [PAYMENTS.md](PAYMENTS.md#adding-an-online-payment-gateway-later). |

## Where each credential goes

| Credential | Environment variable |
|---|---|
| Database connection string | `DATABASE_URL` |
| App secret (generate it yourself with `openssl rand -base64 48`) | `APP_SECRET` |
| Storage keys and buckets | `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_PRIVATE_BUCKET`, `S3_ENDPOINT`, `S3_PUBLIC_URL` |
| SMTP login | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` |
| Turnstile | `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` |

Variables starting with `NEXT_PUBLIC_` are visible in the browser by design (site keys and analytics IDs only). **Never put a secret in a `NEXT_PUBLIC_` variable.**

Payment account details (the Whish number, bank details) are not environment variables. The owner enters them in the dashboard, because customers need to see them to pay.
