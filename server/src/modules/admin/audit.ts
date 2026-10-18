import type { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";

export interface AuditEntry {
  adminId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  meta?: Prisma.InputJsonValue;
  ip?: string;
}

type Db = Pick<Prisma.TransactionClient, "auditLog">;

/**
 * Record an admin action. Pass the transaction client so the change and its audit row commit (or fail) together.
 * Never put secrets or buyer contact details in `meta`.
 */
export function audit(entry: AuditEntry, db: Db = prisma) {
  return db.auditLog.create({ data: entry });
}
