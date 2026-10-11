/**
 * Bring the production database schema up to date.
 *
 *   npm run db:deploy
 *
 * - With migration files in prisma/migrations: applies them (`prisma migrate deploy`).
 * - Without any yet (a fresh project): creates or updates the tables directly
 *   from prisma/schema.prisma (`prisma db push`). This never deletes data: if a
 *   change would lose data, it stops with an error instead.
 *
 * Uses MIGRATE_DATABASE_URL when set, otherwise DATABASE_URL. Set
 * MIGRATE_DATABASE_URL to a DIRECT (non-pooled) connection string when the app
 * itself connects through a pooler (for example Neon's "-pooler" address).
 */

import { execSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";

try {
  process.loadEnvFile?.();
} catch {
  /* no .env file — rely on the environment */
}

const url = process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("✗ DATABASE_URL is not set. Add your database connection string to the environment variables (see docs/NETLIFY.md).");
  process.exit(1);
}

const hasMigrations = existsSync("prisma/migrations") && readdirSync("prisma/migrations").some((name) => /^\d/.test(name));
const command = hasMigrations ? "npx prisma migrate deploy" : "npx prisma db push --skip-generate";
console.log(hasMigrations ? "Applying database migrations…" : "No migration files yet: syncing the database tables with prisma/schema.prisma…");
execSync(command, { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
