import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

type AuditInput = {
  userId?: string | null;
  action:
    | "LOGIN"
    | "LOGOUT"
    | "CREATE"
    | "UPDATE"
    | "DELETE"
    | "APPROVE"
    | "REJECT"
    | "CALCULATE"
    | "FINALIZE"
    | "PASSWORD_CHANGE"
    | "PERMISSION_CHANGE";
  entity: string;
  entityId?: string | null;
  oldData?: unknown;
  newData?: unknown;
  ip?: string | null;
  userAgent?: string | null;
};

/** Audit rows are append-only. Never update or delete them from the app. */
export async function writeAudit(input: AuditInput, tx?: Prisma.TransactionClient) {
  const client = tx ?? prisma;
  try {
    await client.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        oldData: (input.oldData ?? undefined) as Prisma.InputJsonValue | undefined,
        newData: (input.newData ?? undefined) as Prisma.InputJsonValue | undefined,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (error) {
    // Auditing must never break the business transaction, but it must be visible.
    console.error("Failed to write audit log", error);
  }
}
