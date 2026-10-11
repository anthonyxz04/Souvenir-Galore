# Publishing on Netlify

Souvenir Galore is a **Next.js 16 app with a database**, not a static website. On Netlify it uses only Netlify services:

| What | Service | Separate account? |
|---|---|---|
| Website, server code, daily cleanup | **Netlify** (runs Next.js automatically) | Your Netlify account |
| Database (products, orders, customers) | **Netlify Database** (managed PostgreSQL) | No, it's created automatically |
| Product photos and customer uploads | **Netlify Blobs** | No, it's included |
| Emails (verification, password reset, order emails) | Any SMTP provider, e.g. **Resend** | Optional to start, needed before launch |

Netlify Database runs on Netlify's credit-based plans and uses credits for compute while active. Check your credit usage under **Team settings → Billing**.

### Credits on the Free plan

The Free plan includes **300 credits a month, with a hard limit**: when they run out, Netlify pauses the site ("Site not available") until the next month or an upgrade. What uses credits:

| Usage | Credits |
|---|---|
| Each successful production deploy (every push to `main` that changes the website) | 15 |
| Database and server compute while awake | 10 per GB-hour |
| Bandwidth | 20 per GB |
| Page and API requests | 2 per 10,000 |
| Failed deploys and deploy previews | 0 |

To save credits, `netlify.toml` skips the production build when a push only changes docs, tests or CI files. Batch website changes into fewer pushes. Before you start taking real orders, watch the usage for a few days and move to the Personal or Pro plan if the store will need more than the Free plan includes.

## How it's configured

| Setting | Where | Value |
|---|---|---|
| Build command | `netlify.toml` | `npm run netlify-build` |
| Publish directory | `netlify.toml` | `.next` |
| Node version | `netlify.toml` | 22 |
| Database tables and starting data | `netlify/database/migrations/` | Applied by Netlify automatically before each deploy goes live (only new migrations run) |
| Functions | automatic | Netlify's Next.js runtime, plus `netlify/functions/daily-cleanup.mts` (runs daily) |
| Redirects | none needed | Next.js handles every route, including page refreshes. **Don't** add a `/* /index.html 200` rule. |

**The starting data includes:**
- categories and filter tags
- draft collections
- payment methods, all switched off
- delivery areas, all inactive
- homepage sections
- policy page templates
- FAQ drafts

It doesn't include products, users or reviews.

**Environment variables** (Project configuration → Environment variables):

| Variable | Purpose |
|---|---|
| `APP_SECRET` | Random 40+ character secret. Without it, the site shows a "finish setup" page. |
| `CRON_SECRET` | Random value that lets the daily cleanup run |
| `SETUP_TOKEN` | Random value for the one-time owner setup link (below) |
| `STORAGE_DRIVER` | `netlify` (photos in Netlify Blobs) |
| `SMTP_*`, `EMAIL_FROM`, `ADMIN_NOTIFICATION_EMAILS` | Email sending (optional at first) |
| `APP_URL` | Only if you add your own domain and want to force it; otherwise Netlify's address is used |

When you tick **Contains secret values** (recommended for `APP_SECRET`, `CRON_SECRET`, `SETUP_TOKEN` and `SMTP_PASSWORD`), Netlify asks for a value per deploy context. Set the **Production** value. Deploy previews without `APP_SECRET` show the "finish setup" page instead of the shop, which is expected.

## Creating the owner account

The first owner account is created from a **one-time private link**:

```
https://<your-site>.netlify.app/setup-owner?token=<SETUP_TOKEN>
```

- Open it, enter your name, email and a password you choose, and you're taken to the dashboard.
- The page only works while no owner exists. After that it shows "page not found", so the link can't be reused.
- There is no public admin registration and no default password.
- After creating the account, you can delete `SETUP_TOKEN` from the environment variables.

## Updating the site

Every push to the `main` branch on GitHub rebuilds and publishes the site. Schema changes are added as **new** migration files in `netlify/database/migrations/`:
1. Generate the SQL with `npx prisma migrate diff --from-schema-datamodel <old schema> --to-schema-datamodel prisma/schema.prisma --script`.
2. Never edit a migration that has already been applied.

GitHub Actions checks on every push that these migrations match `prisma/schema.prisma` exactly.

## Using your own PostgreSQL instead (optional)

To use Neon or another PostgreSQL provider instead:
1. Set `DATABASE_URL` (pooled) and `MIGRATE_DATABASE_URL` (direct).
2. Set `ADMIN_EMAIL`, `ADMIN_NAME` and `ADMIN_PASSWORD`.

The build then creates the tables, loads the starting data and creates the owner itself. Netlify Database is skipped at runtime whenever `DATABASE_URL` is set.

## Your own domain

1. In Netlify, go to **Domain management → Add a domain** and follow the DNS steps. HTTPS is automatic.
2. Redeploy once, so links in emails and the sitemap use the new address.

## If something goes wrong

| Symptom | Fix |
|---|---|
| The site only shows "Our shop is almost ready" | `APP_SECRET` was missing when it was built. Add it and redeploy. |
| Visitors are asked to log in to Netlify | Project configuration → Access & security → Visitor access: turn off team login protection for production. |
| Photos don't upload | Check that `STORAGE_DRIVER` is `netlify`. |
| Old icon in the browser tab | Press Ctrl+Shift+R (Cmd+Shift+R on Mac), or use a private window. |
| Customers can't verify email or reset passwords | Set up SMTP. For Resend: host `smtp.resend.com`, port `465`, user `resend`, password = your API key, after verifying your domain with Resend. |
