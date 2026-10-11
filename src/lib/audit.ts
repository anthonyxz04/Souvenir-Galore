import { prisma, type Tx } from "./db";

const SENSITIVE_KEY = /pass(word)?|secret|token|hash|credential|api[-_]?key|authorization/i;

/** Remove anything that looks sensitive before it reaches the audit log. */
export function sanitizeMetadata(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => sanitizeMetadata(v, depth + 1));
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY.test(key) ? "[redacted]" : sanitizeMetadata(v, depth + 1);
    }
    return out;
  }
  if (typeof value === "string" && value.length > 1000) return value.slice(0, 1000) + "…";
  return value;
}

export type AuditEntry = {
  actor: { id: string; email: string } | null;
  action: string;
  entityType?: string;
  entityId?: string;
  summary?: string;
  metadata?: unknown;
  ipHash?: string | null;
};

export async function logAudit(entry: AuditEntry, tx?: Tx): Promise<void> {
  const client = tx ?? prisma;
  try {
    await client.auditLog.create({
      data: {
        actorId: entry.actor?.id ?? null,
        actorEmail: entry.actor?.email ?? null,
        action: entry.action,
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        summary: entry.summary?.slice(0, 500) ?? null,
        metadata: entry.metadata === undefined ? undefined : (sanitizeMetadata(entry.metadata) as object),
        ipHash: entry.ipHash ?? null,
      },
    });
  } catch (error) {
    if (tx) throw error;
    console.error("[audit] failed to write audit log", error instanceof Error ? error.message : error);
  }
}
