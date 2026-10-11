# Publishing on Netlify

Souvenir Galore is a **Next.js 16 app with a database**. It isn't a static website, so it needs three things:

| What | Service | Account needed? |
|---|---|---|
| Website, server code, scheduled cleanup | **Netlify** (runs Next.js automatically) | Yes |
| Product photos and customer uploads | **Netlify Blobs** | No, it's included with Netlify |
| Database (products, orders, customers) | **PostgreSQL**, e.g. **Neon** | Yes |
| Emails (verification, password reset, order emails) | Any SMTP provider, e.g. **Resend** | Optional to start, needed before launch |

## Netlify settings (already in `netlify.toml`)

| Setting | Value |
|---|---|
| Build command | `npm run netlify-build` |
| Publish directory | `.next` |
| Node version | 22 |
| Functions | Created automatically by Netlify's Next.js runtime, plus `netlify/functions/daily-cleanup.mts` (scheduled daily) |
| Redirects | None needed. Next.js handles every route, including page refreshes. **Don't** add a `/* /index.html 200` rule. |

`npm run netlify-build` does four things:
1. Brings the database tables up to date. If there are no migration files yet, it creates the tables from `prisma/schema.prisma`, and it never deletes data.
2. Loads the starting data: categories, filters, page templates and payment methods (all switched off). Data that already exists is left alone.
3. Creates your owner account the first time, if `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set.
4. Builds the site.

Deploy previews and branch deploys only build; they never change the database during the build.

## Step by step

### 1. Create the database (about 5 minutes)

1. Sign up at **neon.tech** and click **Create project**. Pick a region near Lebanon, such as AWS Europe (Frankfurt).
2. On the project dashboard, click **Connect**. Copy two connection strings:
   - With **Connection pooling ON**, the address contains `-pooler`. This becomes `DATABASE_URL`; add `&pgbouncer=true` to the end.
   - With **Connection pooling OFF**: this becomes `MIGRATE_DATABASE_URL`.

### 2. Put the project on GitHub

Netlify builds the site from a GitHub repository. Building it on Netlify's Linux servers is what makes photo processing work, so this is more reliable than uploading from your computer.

- **Easiest:** install **GitHub Desktop**, choose **File → Add local repository**, pick the `souvenir-galore` folder, then click **Publish repository** with **Keep this code private** ticked.
- `.env` and other private files are already excluded by `.gitignore`. Only the code goes up.

### 3. Create the site on Netlify

1. Sign up at **netlify.com** with your GitHub account.
2. Click **Add new project → Import an existing project → GitHub**, then choose your `souvenir-galore` repository.
3. Netlify reads the build settings from `netlify.toml`, so leave them as they are.
4. Before deploying, open **Environment variables → Add environment variables → Import from a .env file**. Paste the contents of `netlify.env.example` with your real values:

| Variable | What to put |
|---|---|
| `DATABASE_URL` | Neon **pooled** string with `&pgbouncer=true` added |
| `MIGRATE_DATABASE_URL` | Neon **direct** string |
| `APP_SECRET` | 40+ random letters and numbers from a password generator |
| `CRON_SECRET` | Another random value |
| `STORAGE_DRIVER` | `netlify` |
| `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD` | Your owner sign-in. The password needs 10+ characters and can't be a common one. |
| `SMTP_*`, `EMAIL_FROM`, `ADMIN_NOTIFICATION_EMAILS` | Your email provider's details, or leave them empty for now |

5. Click **Deploy**. The first build takes a few minutes. In the deploy log, look for `✓ Owner account ready for …`.

### 4. Open your site

- **Shop:** `https://<your-site-name>.netlify.app`. You can rename the site under **Project configuration → Change project name**.
- **Dashboard:** `https://<your-site-name>.netlify.app/admin`. Sign in with `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
- Then **delete `ADMIN_PASSWORD`** under **Project configuration → Environment variables**. It's only read during builds.

### 5. Set up the store in the dashboard

1. With no products yet, the dashboard offers **Add sample products** (12 clearly labelled samples) to try the shop, cart and checkout. You can remove them later with **Remove sample products**.
2. Add your real products: **Products → New product**. Upload photos, set the price, stock and category, set the status to **Active**, and save. The product appears in the shop straight away.
3. Fill in **Settings** (contact details, WhatsApp, Instagram), **Delivery & pickup** (fees per area) and **Payments**. Whish Money stays off until you enter its details and switch it on.
4. Work through [GO_LIVE_CHECKLIST.md](GO_LIVE_CHECKLIST.md).

## Deploying by drag and drop (without GitHub)

This works too, but every update means dragging the folder again.

1. Unzip the project and drag the **`souvenir-galore` folder** onto Netlify's deploy area. Netlify builds it.
2. The first build has no settings yet, so it deploys a site that shows **"Our shop is almost ready"** and lists the missing settings.
3. Open **Project configuration → Environment variables → Import from a .env file**. Paste the filled-in `netlify.env.example`.
4. Go to **Deploys** and drag the same folder onto the deploy area again. This build creates the database tables and your owner account, and the shop opens.

## Your own domain

Go to **Domain management → Add a domain** in Netlify and follow its DNS steps; HTTPS is set up for you. Redeploy once afterwards (**Deploys → Trigger deploy**) so links in emails and the sitemap use the new address. You can also set `APP_URL` to it.

## Updating the site later

Commit and push your changes with GitHub Desktop. Netlify rebuilds and publishes automatically.

## If something goes wrong

| Symptom | Fix |
|---|---|
| The site only shows "Our shop is almost ready" | The deploy was built before the settings existed. Add the environment variables, then redeploy (Trigger deploy, or drop the folder again). |
| Build fails with a database connection error | Check both Neon strings; `MIGRATE_DATABASE_URL` must be the one without `-pooler`. |
| Build fails at `ADMIN_PASSWORD: …` | The password is too short or too common. Change it and redeploy. |
| Every page shows an error after deploy | `APP_SECRET` is missing or shorter than 32 characters. The function log says which. |
| Photos don't upload | Make sure `STORAGE_DRIVER` is `netlify`. |
| Old icon in the browser tab | Press Ctrl+Shift+R (Cmd+Shift+R on Mac), or open the site in a private window. |
| Customers can't verify email or reset passwords | Set up SMTP (Resend: host `smtp.resend.com`, port `465`, user `resend`, password = API key, after verifying your domain with Resend). |

## What was and wasn't verified

- **Not verified yet:** this setup hasn't been deployed to Netlify. The environment it was prepared in couldn't install packages or reach Netlify, so the first real deploy is the first full test. Read the deploy log if it fails; the table above covers the likely causes.
- **Verified:** the photo storage code was exercised with the real Netlify Blobs client library against a local stand-in for the Blobs service, covering writing, reading back, private versus public separation, missing files and deletion.
- **Will verify the rest:** the repository includes a GitHub Actions workflow (`.github/workflows/ci.yml`) that runs the full build and every test on each push. Check the **Actions** tab on GitHub after your first push.
