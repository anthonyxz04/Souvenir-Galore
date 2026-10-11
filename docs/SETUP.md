# Local setup

This guide gets the store running on your own computer for development or for trying it out. To put it online, see [DEPLOYMENT.md](DEPLOYMENT.md).

## Requirements

- **Node.js 22.12 or newer** (22 LTS).
- **PostgreSQL 14 or newer.** Use a local install, Docker (`docker compose up db`), or a free cloud database (see [SERVICES.md](SERVICES.md)).
- Around 1 GB of free disk space for dependencies.

## The short way

```bash
npm install
npm run setup
npm run dev
```

`npm run setup` does steps 2–5 below for you: it creates `.env` with a random `APP_SECRET`, asks for your database connection string, creates the tables, loads the starting data, offers the sample products, and creates your owner account. The sections below explain each step if you'd rather do them by hand.

## 1. Install dependencies

```bash
npm install
```

The first install creates `package-lock.json`. **Commit it.** Deployments and Docker builds then install exactly the same versions (`npm ci`). `npm install` also runs `prisma generate` automatically.

## 2. Configure the environment

```bash
cp .env.example .env
```

At minimum, set:

| Variable | Value for local development |
|---|---|
| `DATABASE_URL` | e.g. `postgresql://souvenir:yourpassword@localhost:5432/souvenir_galore?schema=public` |
| `APP_SECRET` | a random string of at least 32 characters, from `openssl rand -base64 48` |
| `APP_URL` | `http://localhost:3000` |
| `TRUST_PROXY` | `false` when running directly on your computer |

You can leave everything else empty locally:
- **Email:** with no SMTP settings, emails (verification links, password resets, order confirmations) are **printed to the terminal** in development, so you can click the links from there.
- **Storage:** images are stored in `./storage` (which is git-ignored).

`.env` is git-ignored. Never commit it.

## 3. Create the database tables

The first time only, create the initial migration from the schema:

```bash
npx prisma migrate dev --name init
```

This creates `prisma/migrations/<timestamp>_init/migration.sql`. **Commit the `prisma/migrations` folder.** Production applies these files with `npm run db:deploy`.

> The migration was not generated in the original build environment because the Prisma CLI could not be downloaded there. This one command creates it from `prisma/schema.prisma`.
>
> Hosted deploys (Netlify, Docker) also work before any migration files exist: `npm run db:deploy` then creates the tables straight from the schema (`prisma db push`), and it refuses changes that would delete data. If you later start using migration files on a database created that way, mark the first one as already applied once: `npx prisma migrate resolve --applied <migration_folder_name>`.

Later, when you change `prisma/schema.prisma`, create a new migration with `npm run db:migrate -- --name describe-the-change`.

## 4. Load the starting data

```bash
npm run db:seed
```

This creates the initial catalog structure and store setup:
- The category tree: candles, personalized gifts, religious souvenirs, home décor, seasonal.
- Filter groups: occasion, recipient, color, material, scent.
- Draft collections.
- **All payment methods disabled.**
- **All delivery areas inactive with no fee.**
- Homepage sections.
- Policy page templates flagged for owner review.
- Draft FAQ entries.

It doesn't create products, users, reviews or contact details, and it's safe to run again (existing data is left alone).

## 5. Create the first administrator (owner)

```bash
npm run admin:create
```

The script asks for an email, a name and a password. The password is hidden as you type and must meet the password policy: at least 10 characters, not a common password, and not containing the email. The account is created as **Owner** with its email marked verified.

- There is **no default admin account and no default password** anywhere in the code.
- If the email already belongs to a customer account, that account is promoted to Owner (its existing password is kept).
- For automated setups (CI, containers) you can pass `ADMIN_EMAIL`, `ADMIN_NAME` and `ADMIN_PASSWORD` as environment variables for that single command. Don't save them in `.env` or in your shell history. One way is `read -s ADMIN_PASSWORD && ADMIN_PASSWORD="$ADMIN_PASSWORD" ADMIN_EMAIL=you@example.com ADMIN_NAME="Your Name" npm run admin:create`.
- To add more staff later, use **Dashboard → Staff**. Only the Owner can manage staff.

## 6. Start the app

```bash
npm run dev
```

- Storefront: <http://localhost:3000>
- Dashboard: <http://localhost:3000/admin> (sign in with the owner account)

Non-staff visitors to `/admin` get a "page not found" response, so the dashboard isn't advertised.

## 7. Optional: sample catalog

```bash
npm run db:demo          # 12 sample products with illustrated images
npm run db:demo:remove   # remove them again
```

Demo products are only for trying out the store:
- Their SKUs start with `DEMO-` and their descriptions say they are samples.
- The dashboard shows a red warning while any remain.
- `db:demo:remove` deletes them. Any demo product that already appears in an order is archived instead of deleted, so order history stays intact.

## Useful commands

| Command | What it does |
|---|---|
| `npm run db:studio` | Opens Prisma Studio, a database browser, at <http://localhost:5555> |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit tests |
| `npm run maintenance:cleanup` | Housekeeping (see [DEPLOYMENT.md](DEPLOYMENT.md#scheduled-jobs)) |

## Troubleshooting

- **`Can't reach database server`:** check that PostgreSQL is running and that `DATABASE_URL` is correct. With Docker, run `docker compose up db -d` and use `localhost:5432`.
- **Verification emails never arrive (locally):** with no SMTP configured, they're printed in the terminal running `npm run dev`.
- **Images fail to upload:** the limit is set by `UPLOAD_MAX_MB` (default 4 MB after in-browser compression). Accepted formats are JPEG, PNG, WebP and AVIF. iPhones convert HEIC photos to JPEG automatically when uploading from Safari.
- **Sign-in doesn't stick:** when `APP_URL` starts with `https://`, the session cookie only works over HTTPS. For local testing keep `APP_URL=http://localhost:3000`.
