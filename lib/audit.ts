import "server-only"

import { prisma } from "@/lib/prisma"
import type { Prisma } from "@/lib/generated/prisma/client"

interface AuditLogInput {
  clinicId?: string | null
  userId?: string | null
  action: string
  entity: string
  entityId?: string | null
  description?: string
  metadata?: Prisma.InputJsonValue
}

/**
 * Writes an audit log entry. Never throws — a failure to record an audit
 * log must not break the auth/business flow that triggered it.
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
    console.error("[createAuditLog] failed to write audit log:", error)
  }
}
