import "server-only"

import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import type { AuditActionValue } from "@/lib/audit-actions"
import type { Prisma } from "@/lib/generated/prisma/client"

interface AuditLogInput {
  clinicId?: string | null
  userId?: string | null
  /** Prefer a value from `AuditAction`, but any string is accepted. */
  action: AuditActionValue | (string & {})
  entity: string
  entityId?: string | null
  description?: string
  metadata?: Prisma.InputJsonValue
}

/**
 * Writes an audit log entry. Never throws — a failure to record an audit
 * log must not break the business flow that triggered it; the failure is
 * itself logged (and forwarded to Sentry) via the internal logger.
 */
export async function createAuditLog(input: AuditLogInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        clinicId: input.clinicId ?? null,
        userId: input.userId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        description: input.description,
        metadata: input.metadata,
      },
    })
  } catch (error) {
    logger.error("Falha ao gravar audit log", {
      context: "audit",
      error,
      metadata: { action: input.action, entity: input.entity },
    })
  }
}
