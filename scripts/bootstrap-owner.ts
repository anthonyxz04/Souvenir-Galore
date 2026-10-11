/**
 * Creates the FIRST owner account during a deploy, for hosts where you can't
 * run `npm run admin:create` yourself (for example Netlify).
 *
 * Runs on every production build but only acts when ALL of these are true:
 *   - ADMIN_EMAIL and ADMIN_PASSWORD are set in the host's environment variables
 *   - no owner account exists yet
 * Otherwise it does nothing. After your first successful deploy and sign-in,
 * delete ADMIN_PASSWORD from the environment variables.
 *
 * The password is never printed. It must pass the same policy as everywhere
 * else (10+ characters, not a common password).
 */

import { PrismaClient } from "@prisma/client";
import { hashPassword, passwordPolicyError } from "../src/lib/auth/password";
import { normalizeEmail } from "../src/lib/text";

try {
  process.loadEnvFile?.();
} catch {
  /* no .env */
}

const prisma = new PrismaClient({ datasourceUrl: process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL });

async function main() {
  const rawEmail = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD ?? "";
  const name = process.env.ADMIN_NAME?.trim() || "Store owner";

  const owners = await prisma.user.count({ where: { role: "OWNER", deletedAt: null } });
  if (owners > 0) {
    if (password) console.log("· An owner account already exists. You can now delete ADMIN_PASSWORD from your environment variables.");
    return;
  }
  if (!rawEmail || !password) {
    console.log("· No owner account yet. Set ADMIN_EMAIL and ADMIN_PASSWORD in your environment variables and redeploy to create it.");
    return;
  }

  const email = normalizeEmail(rawEmail);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("ADMIN_EMAIL doesn't look like an email address.");
  const policy = passwordPolicyError(password, { email, name });
  if (policy) throw new Error(`ADMIN_PASSWORD: ${policy}`);

  const existing = await prisma.user.findUnique({ where: { email } });
  const user = existing
    ? await prisma.user.update({ where: { id: existing.id }, data: { role: "OWNER", emailVerifiedAt: existing.emailVerifiedAt ?? new Date(), disabledAt: null } })
    : await prisma.user.create({ data: { email, name, role: "OWNER", passwordHash: await hashPassword(password), emailVerifiedAt: new Date() } });
  await prisma.auditLog.create({
    data: { action: "staff.create_owner", entityType: "User", entityId: user.id, actorEmail: "deploy", summary: `${email} set up as the first owner during deploy` },
  });
  console.log(`✓ Owner account ready for ${email}. Sign in at /login, then delete ADMIN_PASSWORD from your environment variables.`);
}

main()
  .catch((error) => {
    console.error(`✗ ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
