/**
 * Netlify production build.
 *
 *   npm run netlify-build      (set as the build command in netlify.toml)
 *
 * Database:
 *   - Netlify Database (default, nothing to configure): Netlify provisions it
 *     and applies netlify/database/migrations before publishing.
 *   - Your own PostgreSQL (DATABASE_URL set): tables, starting data and the
 *     first owner (ADMIN_EMAIL/ADMIN_PASSWORD) are handled here.
 * Without APP_SECRET the site still deploys and shows a "finish setup" page.
 */

import { execSync } from "node:child_process";

const run = (command) => execSync(command, { stdio: "inherit" });

if ((process.env.APP_SECRET ?? "").length < 32) {
  console.log("\n────────────────────────────────────────────────────────────");
  console.log(" Souvenir Galore: APP_SECRET is missing (at least 32 random characters).");
  console.log(" The site will deploy and show a 'finish setup' page until it is added.");
  console.log(" Add it in Netlify (Project configuration → Environment variables),");
  console.log(" then redeploy. Guide: docs/NETLIFY.md");
  console.log("────────────────────────────────────────────────────────────\n");
}

if (process.env.DATABASE_URL) {
  // Your own PostgreSQL (e.g. Neon): update the tables, load the starting data
  // and create the first owner here, during the build.
  run("node scripts/migrate-deploy.mjs");
  run("npx tsx prisma/seed.ts");
  run("npx tsx scripts/bootstrap-owner.ts");
} else {
  // Netlify Database: Netlify creates the database and applies the migrations
  // in netlify/database/migrations (tables + starting data) before publishing.
  console.log("Using Netlify Database: netlify/database/migrations are applied by Netlify before this deploy is published.");
}

run("npm run build");
