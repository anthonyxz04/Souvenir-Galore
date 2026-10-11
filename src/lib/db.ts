import { PrismaClient } from "@prisma/client";

/**
 * Single Prisma client per process. In development, Next.js hot reloading would
 * otherwise create a new client (and connection pool) on every change.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * DATABASE_URL (any PostgreSQL), or on Netlify the built-in Netlify Database
 * connection (NETLIFY_DB_URL), which Netlify provides automatically.
 */
export function databaseUrl(): string | undefined {
  return process.env.DATABASE_URL || process.env.NETLIFY_DB_URL || undefined;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: databaseUrl(),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
