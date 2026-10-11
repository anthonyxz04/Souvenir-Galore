# Deployment

You can host the store in three supported ways. **Netlify** has its own beginner guide: [NETLIFY.md](NETLIFY.md). The other two are below:

- **[A. Vercel with managed services](#a-vercel--managed-postgres--cloudflare-r2--smtp):** the least maintenance. Recommended unless you're comfortable running a server.
- **[B. Docker on a single server (VPS)](#b-docker-on-a-single-server):** lower monthly cost, but you're responsible for updates, backups and uptime.

Both options need the accounts listed in [SERVICES.md](SERVICES.md). Before taking real orders, also work through [GO_LIVE_CHECKLIST.md](GO_LIVE_CHECKLIST.md).

## Before either option

1. Push the code to a **private** Git repository (GitHub, GitLab…). Make sure `.env` is not committed: it's in `.gitignore`, and `git status` must never show it.
2. Generate and commit `package-lock.json` (`npm install`) and the initial migration (`npx prisma migrate dev --name init`). See [SETUP.md](SETUP.md#3-create-the-database-tables).
3. Generate the secrets:
   ```bash
   openssl rand -base64 48   # APP_SECRET
   openssl rand -base64 32   # CRON_SECRET (Vercel only)
   ```

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `APP_URL` | ✔ | `https://yourdomain.com`, with no trailing slash. Used in emails, canonical URLs and the sitemap. |
| `DATABASE_URL` | ✔ | Production database. Add `sslmode=require` if your provider needs it. |
| `MIGRATE_DATABASE_URL` | when pooled | A direct, non-pooled connection used only by `npm run db:deploy`. |
| `APP_SECRET` | ✔ | 32+ random characters. **The app refuses to start in production without it.** If you change it, rate-limit counters reset and existing IP hashes in logs no longer match. |
| `TRUST_PROXY` | ✔ | `true` behind Vercel, Cloudflare, Caddy or Nginx (needed for per-IP rate limits). `false` only if the app is reached directly. |
| `STORAGE_DRIVER` | ✔ | `s3` on Vercel (it has no persistent disk); `local` or `s3` on a VPS. |
| `S3_*` | with `s3` | See [Object storage](#object-storage-cloudflare-r2-example). |
| `SMTP_*`, `EMAIL_FROM` | ✔ | Without SMTP in production, emails are skipped, which means **customers cannot verify accounts or reset passwords**. |
| `ADMIN_NOTIFICATION_EMAILS` | recommended | Comma-separated addresses that get new-order and new-request notifications. |
| `CRON_SECRET` | Vercel | Protects the daily cleanup endpoint. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | optional | Bot protection on public forms. |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` or `NEXT_PUBLIC_GA_MEASUREMENT_ID` | optional | Analytics. |
| `UPLOAD_MAX_MB` | optional | Default 4. On Vercel keep it at 4 or less (the platform limits request bodies to about 4.5 MB). |

> **`NEXT_PUBLIC_*` values are compiled in at build time.** After changing one, redeploy (Vercel) or rebuild the image (Docker).

---

## A. Vercel + managed Postgres + Cloudflare R2 + SMTP

### 1. Database (Neon shown; Supabase and others are similar)

1. Create a project in a region close to where you'll host the app, for example Frankfurt (`eu-central-1`) for visitors in Lebanon and Europe.
2. Copy two connection strings:
   - **Pooled** (the host contains `-pooler`). Use it for `DATABASE_URL`, with `&pgbouncer=true` appended, e.g. `postgresql://user:pass@ep-xxx-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true`.
   - **Direct** (no `-pooler`). Use it for `MIGRATE_DATABASE_URL`.
3. Turn on the provider's backups and point-in-time restore (see [BACKUP.md](BACKUP.md)).

### 2. Object storage (Cloudflare R2 example)

1. Create **two buckets**, for example `souvenir-public` and `souvenir-private`.
2. On `souvenir-public`, connect a **custom domain** (for example `images.yourdomain.com`) or enable the r2.dev public URL.
   - **Leave `souvenir-private` private.** It holds customers' reference photos, which only staff can open, through the dashboard.
3. Create an **API token** with *Object Read & Write* permission restricted to those two buckets.
4. Set the storage variables:
   ```
   STORAGE_DRIVER=s3
   S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
   S3_REGION=auto
   S3_BUCKET=souvenir-public
   S3_PRIVATE_BUCKET=souvenir-private
   S3_ACCESS_KEY_ID=…
   S3_SECRET_ACCESS_KEY=…
   S3_PUBLIC_URL=https://images.yourdomain.com
   ```
   With `S3_PUBLIC_URL` set, product images load directly from the bucket's CDN. The Content Security Policy allows that origin automatically.

For **AWS S3**, leave `S3_ENDPOINT` empty, set the real region, and use a bucket policy that allows public `GetObject` on `public/*` only (or put CloudFront in front of it). Keep Block Public Access **on** for the private bucket.

### 3. Email

1. Add and verify your domain with your SMTP provider. Create the SPF, DKIM and (recommended) DMARC DNS records it gives you.
2. Set `SMTP_HOST`, `SMTP_PORT` (587 with `SMTP_SECURE=false`, or 465 with `true`), `SMTP_USER`, `SMTP_PASSWORD`, and `EMAIL_FROM="Souvenir Galore <orders@yourdomain.com>"`.

### 4. Vercel project

1. **Add New → Project**, then import the repository. The framework preset is Next.js.
2. Set **Build Command** to `npm run vercel-build`. This runs `npm run db:deploy` (applies migrations through `MIGRATE_DATABASE_URL`, or `DATABASE_URL` if that isn't set) and then `npm run build`.
3. Add every environment variable from the table above, for the **Production** environment.
   - **Preview deployments** also run the build command, so either give the Preview environment its own database (a Neon branch, for example) or don't define `DATABASE_URL` for Preview. Never let previews migrate the production database.
4. Under **Settings → Functions**, set the region to match the database region.
5. Deploy. Then add your domain under **Settings → Domains** and set `APP_URL` to it. Redeploy after changing `APP_URL`.

### 5. Seed and create the owner (once)

Run these from your computer against the production database. Use the **direct** connection string, and type the password at the prompt:

```bash
DATABASE_URL="<direct production url>" npm run db:seed
DATABASE_URL="<direct production url>" npm run admin:create
```

### 6. Scheduled cleanup

`vercel.json` schedules `/api/cron/cleanup` once a day. Vercel sends `Authorization: Bearer $CRON_SECRET` automatically once `CRON_SECRET` is set. Without `CRON_SECRET`, the endpoint returns 404.

---

## B. Docker on a single server

Use a Linux VPS with at least 2 GB of RAM. The build needs it; 1 GB plus swap also works. You'll also need Docker Engine with the Compose plugin, and a domain whose A/AAAA records point at the server.

```bash
git clone <your private repo> souvenir-galore && cd souvenir-galore
cp .env.example .env
nano .env          # fill in the values below
```

In `.env`, set:
- `POSTGRES_PASSWORD`: long and random, using letters and digits only.
- `APP_URL=https://yourdomain.com`
- `APP_SECRET`
- `TRUST_PROXY=true`
- `STORAGE_DRIVER=local`, or `s3` with the R2 settings above
- `SMTP_*` and `EMAIL_FROM`

`docker-compose.yml` builds `DATABASE_URL` automatically, so leave it as it is in `.env`.

```bash
# Start Postgres + the app + Caddy (automatic HTTPS certificates):
DOMAIN=yourdomain.com docker compose --profile https up -d --build

# First time only:
docker compose exec app npm run db:seed
docker compose exec app npm run admin:create
```

What this setup does:
- The app container **applies pending migrations on every start**, then starts Next.js.
- PostgreSQL isn't exposed to the internet. The app listens only on `127.0.0.1:3000`, and Caddy serves ports 80 and 443.
- Uploaded images (with `STORAGE_DRIVER=local`) live in the `uploads` Docker volume, and the database lives in `db-data`. **Back up both** (see [BACKUP.md](BACKUP.md)).

To use your own Nginx instead of Caddy, run `docker compose up -d --build` without the profile and proxy to `127.0.0.1:3000`. Pass `X-Forwarded-For` and `X-Forwarded-Proto` through, and set `client_max_body_size 6m;`.

**Updating:**

```bash
git pull
DOMAIN=yourdomain.com docker compose --profile https up -d --build
```

**Scheduled jobs** (add with `crontab -e` on the server):

```cron
# Daily housekeeping at 03:17
17 3 * * * cd /path/to/souvenir-galore && docker compose exec -T app npm run maintenance:cleanup >> /var/log/souvenir-cleanup.log 2>&1
# Nightly backup at 02:30 (then copy ./backups off the server, see BACKUP.md)
30 2 * * * cd /path/to/souvenir-galore && ./scripts/backup.sh --compose >> /var/log/souvenir-backup.log 2>&1
```

**Server basics:**
- Enable automatic security updates (`unattended-upgrades` on Ubuntu or Debian).
- Allow only SSH, HTTP and HTTPS through the firewall (`ufw allow OpenSSH 80 443`).
- Use SSH keys and disable password login.

---

## Scheduled jobs

| Job | How often | Vercel | Server |
|---|---|---|---|
| Cleanup: expired sessions and tokens, old guest carts, unconfirmed newsletter signups, unused images | Daily | `vercel.json` cron plus `CRON_SECRET` | `npm run maintenance:cleanup` from cron |
| Database backup | Daily | Provider's automatic backups, plus an occasional `pg_dump` (see [BACKUP.md](BACKUP.md)) | `scripts/backup.sh` from cron |

## After deploying

- Open `https://yourdomain.com/api/health`. It should return `{"ok":true}`. Point an uptime monitor at this URL.
- Sign in at `/login`, open `/admin`, and work through the **Before you start selling** list on the dashboard.
- Place a test order end to end (see [GO_LIVE_CHECKLIST.md](GO_LIVE_CHECKLIST.md)).

## Troubleshooting

- **Build fails with `Can't reach database server` during `db:deploy`:** check `MIGRATE_DATABASE_URL` and `DATABASE_URL`, and that the database allows connections from Vercel. Neon and Supabase allow them by default.
- **`prepared statement "s0" already exists`:** `DATABASE_URL` points at a pooler without `pgbouncer=true`. Add it.
- **Images upload but don't display:** check `S3_PUBLIC_URL`, and that the public bucket really allows public reads of `public/*`.
- **You're signed out immediately after signing in:** when `APP_URL` starts with `https://`, the session cookie is HTTPS-only (with the `__Host-` prefix), so the site must really be served over HTTPS. Check `APP_URL`, and that your proxy sends `X-Forwarded-Proto: https`.
- **Rate limits hit everyone at once:** `TRUST_PROXY` is `false` behind a proxy, so every visitor appears to come from the proxy's IP address.
