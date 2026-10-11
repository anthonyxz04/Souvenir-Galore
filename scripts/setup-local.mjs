/**
 * One-time local setup:
 *
 *   npm run setup
 *
 *  1. creates .env from .env.example with a fresh random APP_SECRET
 *     (asks for your PostgreSQL connection string if it isn't set yet)
 *  2. creates the database tables (first run: generates the initial migration)
 *  3. loads the starting store data
 *  4. optionally adds the clearly labelled sample products
 *  5. creates your owner account (you choose the password; nothing is stored in code)
 *
 * Safe to run again: existing data and an existing .env are kept.
 */

import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const rl = createInterface({ input, output });
const run = (command, env = {}) => execSync(command, { stdio: "inherit", env: { ...process.env, ...env } });

function readEnv() {
  return Object.fromEntries(
    readFileSync(".env", "utf8")
      .split(/\r?\n/)
      .filter((line) => /^[A-Z0-9_]+=/.test(line))
      .map((line) => {
        const i = line.indexOf("=");
        return [line.slice(0, i), line.slice(i + 1).replace(/^"(.*)"$/, "$1")];
      }),
  );
}

function setEnvValue(key, value) {
  const text = readFileSync(".env", "utf8");
  const line = `${key}="${value}"`;
  const next = new RegExp(`^${key}=.*$`, "m").test(text) ? text.replace(new RegExp(`^${key}=.*$`, "m"), line) : `${text.trimEnd()}\n${line}\n`;
  writeFileSync(".env", next);
}

console.log("\nSouvenir Galore: local setup\n");

// 1. .env
if (!existsSync(".env")) {
  writeFileSync(".env", readFileSync(".env.example", "utf8"));
  setEnvValue("APP_SECRET", randomBytes(48).toString("base64url"));
  setEnvValue("APP_URL", "http://localhost:3000");
  setEnvValue("TRUST_PROXY", "false");
  console.log("✓ Created .env with a new random APP_SECRET");
}
let env = readEnv();
if (!env.DATABASE_URL || env.DATABASE_URL.includes("USER:PASSWORD@HOST")) {
  console.log("\nPaste your PostgreSQL connection string.");
  console.log("Example: postgresql://postgres:YOURPASSWORD@localhost:5432/souvenir_galore\n");
  const url = (await rl.question("DATABASE_URL: ")).trim();
  if (!/^postgres(ql)?:\/\//.test(url)) {
    console.error("That doesn't look like a PostgreSQL connection string. Nothing else was changed.");
    process.exit(1);
  }
  setEnvValue("DATABASE_URL", url);
  env = readEnv();
}
const dbEnv = { DATABASE_URL: env.DATABASE_URL };

// 2. Tables
const hasMigrations = existsSync("prisma/migrations") && readdirSync("prisma/migrations").some((name) => /^\d/.test(name));
console.log(hasMigrations ? "\nApplying database migrations…" : "\nCreating the database tables (first run)…");
run(hasMigrations ? "npx prisma migrate deploy" : "npx prisma migrate dev --name init", dbEnv);

// 3. Starting data
console.log("\nLoading the starting store data…");
run("npx tsx prisma/seed.ts", dbEnv);

// 4. Sample products
const demo = (await rl.question("\nAdd 12 sample products so you can try the shop? They are labelled as samples and easy to remove. (y/n) ")).trim().toLowerCase();
if (demo === "y" || demo === "yes") run("npx tsx prisma/demo-seed.ts", dbEnv);

// 5. Owner account
rl.close();
console.log("\nCreate your owner account (you'll sign in to /admin with it):");
run("npx tsx scripts/create-admin.ts", dbEnv);

console.log(`
All set. Start the site with:

  npm run dev

Then open http://localhost:3000 (shop) and http://localhost:3000/admin (dashboard).
`);
