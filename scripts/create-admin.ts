/**
 * Create the first store owner (or promote an existing account).
 *
 *   npm run admin:create
 *
 * Prompts for email, name and password (the password is not echoed).
 * For automated setups you can pass ADMIN_EMAIL, ADMIN_NAME and ADMIN_PASSWORD
 * as environment variables — avoid putting passwords in your shell history.
 * There is no default administrator or default password.
 */

import { createInterface } from "node:readline";
import { PrismaClient } from "@prisma/client";
import { hashPassword, passwordPolicyError } from "../src/lib/auth/password";
import { normalizeEmail } from "../src/lib/text";

try {
  process.loadEnvFile?.();
} catch {
  /* no .env */
}

const prisma = new PrismaClient();

function ask(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      const output = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
      output._writeToOutput = (text: string) => {
        if (text.includes(question)) output.output.write(text);
        else output.output.write("*");
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log("Create a Souvenir Galore store owner account\n");
  const email = normalizeEmail(process.env.ADMIN_EMAIL || (await ask("Email: ")));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("That doesn't look like an email address.");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const confirm = process.env.ADMIN_EMAIL ? "yes" : await ask(`An account for ${email} exists (role: ${existing.role}). Make it an owner? (yes/no): `);
    if (confirm.toLowerCase() !== "yes") return console.log("Nothing changed.");
    await prisma.user.update({ where: { id: existing.id }, data: { role: "OWNER", emailVerifiedAt: existing.emailVerifiedAt ?? new Date(), disabledAt: null } });
    await prisma.session.deleteMany({ where: { userId: existing.id } });
    await prisma.auditLog.create({ data: { action: "staff.role", entityType: "User", entityId: existing.id, actorEmail: "cli", summary: `${email}: ${existing.role} → OWNER (command line)` } });
    return console.log(`✓ ${email} is now an owner. Sign in at /login.`);
  }

  const name = process.env.ADMIN_NAME || (await ask("Full name: "));
  if (!name) throw new Error("A name is required.");
  let password = process.env.ADMIN_PASSWORD || "";
  if (!password) {
    password = await ask("Password (min. 10 characters): ", true);
    const repeat = await ask("Repeat password: ", true);
    if (password !== repeat) throw new Error("The passwords don't match.");
  }
  const policy = passwordPolicyError(password, { email, name });
  if (policy) throw new Error(policy);

  const user = await prisma.user.create({
    data: { email, name, role: "OWNER", passwordHash: await hashPassword(password), emailVerifiedAt: new Date() },
  });
  await prisma.auditLog.create({ data: { action: "staff.create_owner", entityType: "User", entityId: user.id, actorEmail: "cli", summary: `${email} created as owner (command line)` } });
  console.log(`\n✓ Owner account created for ${email}. Sign in at /login, then open /admin.`);
}

main()
  .catch((error) => {
    console.error(`\n✗ ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
