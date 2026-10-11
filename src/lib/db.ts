import { PrismaClient } from "@prisma/client";
import { databaseUrl } from "@/lib/db-url";

export { databaseUrl };

/**
 * Single Prisma client per process. In development, Next.js hot reloading would
 * otherwise create a new client (and connection pool) on every change.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: databaseUrl(),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
