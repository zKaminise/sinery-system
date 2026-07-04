import "server-only"

import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"

/** Platform-level audit actions (founder panel). */
export const PlatformAuditAction = {
  LOGIN_SUCCESS: "PLATFORM_LOGIN_SUCCESS",
  LOGIN_FAILED: "PLATFORM_LOGIN_FAILED",
  LOGOUT: "PLATFORM_LOGOUT",
  PASSWORD_CHANGED: "PLATFORM_PASSWORD_CHANGED",
  ACCESS_DENIED: "PLATFORM_ACCESS_DENIED",
  CLINIC_CREATED: "PLATFORM_CLINIC_CREATED",
  CLINIC_UPDATED: "PLATFORM_CLINIC_UPDATED",
  CLINIC_SUSPENDED: "PLATFORM_CLINIC_SUSPENDED",
  CLINIC_REACTIVATED: "PLATFORM_CLINIC_REACTIVATED",
  OWNER_CREATED: "PLATFORM_OWNER_CREATED",
  SUBSCRIPTION_CREATED: "PLATFORM_SUBSCRIPTION_CREATED",
  SUBSCRIPTION_UPDATED: "PLATFORM_SUBSCRIPTION_UPDATED",
  INVOICE_CREATED: "PLATFORM_INVOICE_CREATED",
  INVOICE_MARKED_PAID: "PLATFORM_INVOICE_MARKED_PAID",
  INVOICE_MARKED_OVERDUE: "PLATFORM_INVOICE_MARKED_OVERDUE",
  INVOICE_CANCELLED: "PLATFORM_INVOICE_CANCELLED",
  PLAN_CREATED: "PLATFORM_PLAN_CREATED",
  PLAN_UPDATED: "PLATFORM_PLAN_UPDATED",
  BILLING_STATUS_RECALCULATED: "PLATFORM_BILLING_STATUS_RECALCULATED",
  NOTIFICATION_MOCKED: "PLATFORM_NOTIFICATION_MOCKED",
} as const

export type PlatformAuditActionValue =
  (typeof PlatformAuditAction)[keyof typeof PlatformAuditAction]

export interface PlatformAuditInput {
  platformUserId?: string | null
  action: PlatformAuditActionValue
  targetType?: string | null
  targetId?: string | null
  metadata?: Record<string, unknown> | null
  ipAddress?: string | null
  userAgent?: string | null
}

/**
 * Records a platform audit row. Never throws (audit failures must not break the
 * action). NEVER pass secrets/passwords/tokens in metadata.
 */
export async function createPlatformAuditLog(input: PlatformAuditInput): Promise<void> {
  try {
    await prisma.platformAuditLog.create({
      data: {
        platformUserId: input.platformUserId ?? null,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        metadata: (input.metadata ?? undefined) as object | undefined,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    })
  } catch (error) {
    logger.error("Falha ao gravar PlatformAuditLog", {
      context: "platform.audit",
      error,
      metadata: { action: input.action },
    })
  }
}
