import "server-only"

import { prisma } from "@/lib/prisma"
import { AuditAction, type AuditActionValue } from "@/lib/audit-actions"
import { getClinicTimeZone, clinicToday, getDayRangeUtc } from "@/lib/appointments/date-utils"

export interface AiUsageSummary {
  callsToday: number
  tokensToday: number
  estimatedCostTodayCents: number
  successToday: number
  errorToday: number
  fallbacksToHuman: number
  toolsToday: number
  sensitiveToday: number
}

export interface AiUsageRow {
  id: string
  createdAt: string
  provider: string
  mode: string | null
  model: string | null
  conversationId: string | null
  success: boolean
  inputTokens: number | null
  outputTokens: number | null
  totalTokens: number | null
  estimatedCostInCents: number | null
  errorCode: string | null
  latencyMs: number | null
}

export interface AiUsageLogsResult {
  rows: AiUsageRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface AiUsageFilters {
  dateFrom?: string
  dateTo?: string
  provider?: string
  model?: string
  success?: "true" | "false"
  conversationId?: string
  errorCode?: string
  page?: number
  pageSize?: number
}

async function todayRange(clinicId: string) {
  const settings = await prisma.clinicSettings.findUnique({ where: { clinicId }, select: { timezone: true } })
  const tz = getClinicTimeZone(settings?.timezone)
  return getDayRangeUtc(clinicToday(tz), tz)
}

function auditCountToday(clinicId: string, start: Date, end: Date, actions: AuditActionValue[]): Promise<number> {
  return prisma.auditLog.count({
    where: { clinicId, action: { in: actions as string[] }, createdAt: { gte: start, lt: end } },
  })
}

/** Today's AI usage KPIs (clinic timezone). Mixes usage rows + audit counts. */
export async function getAiUsageSummary(clinicId: string): Promise<AiUsageSummary> {
  const { start, end } = await todayRange(clinicId)
  const usageWhere = { clinicId, createdAt: { gte: start, lt: end } }

  const [calls, agg, success, error, fallbacks, tools, sensitive] = await Promise.all([
    prisma.aiUsageLog.count({ where: usageWhere }),
    prisma.aiUsageLog.aggregate({ where: usageWhere, _sum: { totalTokens: true, estimatedCostInCents: true } }),
    prisma.aiUsageLog.count({ where: { ...usageWhere, success: true } }),
    prisma.aiUsageLog.count({ where: { ...usageWhere, success: false } }),
    auditCountToday(clinicId, start, end, [AuditAction.ASSIST_TRANSFERRED_TO_HUMAN]),
    auditCountToday(clinicId, start, end, [AuditAction.ASSIST_TOOL_EXECUTED]),
    auditCountToday(clinicId, start, end, [
      AuditAction.ASSIST_SENSITIVE_MESSAGE_DETECTED,
      AuditAction.ASSIST_HIGH_RISK_MESSAGE_DETECTED,
      AuditAction.ASSIST_CRITICAL_RISK_MESSAGE_DETECTED,
    ]),
  ])

  return {
    callsToday: calls,
    tokensToday: agg._sum.totalTokens ?? 0,
    estimatedCostTodayCents: agg._sum.estimatedCostInCents ?? 0,
    successToday: success,
    errorToday: error,
    fallbacksToHuman: fallbacks,
    toolsToday: tools,
    sensitiveToday: sensitive,
  }
}

/** Paginated, filterable AiUsageLog table (tenant-scoped). */
export async function getAiUsageLogs(clinicId: string, filters: AiUsageFilters): Promise<AiUsageLogsResult> {
  const page = Math.max(1, filters.page ?? 1)
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 20))

  const where: Record<string, unknown> = { clinicId }
  if (filters.provider) where.provider = filters.provider
  if (filters.model) where.model = filters.model
  if (filters.success === "true") where.success = true
  if (filters.success === "false") where.success = false
  if (filters.conversationId) where.conversationId = filters.conversationId
  if (filters.errorCode) where.errorCode = filters.errorCode

  const createdAt: { gte?: Date; lte?: Date } = {}
  if (filters.dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(filters.dateFrom)) {
    createdAt.gte = new Date(`${filters.dateFrom}T00:00:00.000Z`)
  }
  if (filters.dateTo && /^\d{4}-\d{2}-\d{2}$/.test(filters.dateTo)) {
    createdAt.lte = new Date(`${filters.dateTo}T23:59:59.999Z`)
  }
  if (createdAt.gte || createdAt.lte) where.createdAt = createdAt

  const [rows, total] = await Promise.all([
    prisma.aiUsageLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        createdAt: true,
        provider: true,
        mode: true,
        model: true,
        conversationId: true,
        success: true,
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
        estimatedCostInCents: true,
        errorCode: true,
        latencyMs: true,
      },
    }),
    prisma.aiUsageLog.count({ where }),
  ])

  return {
    rows: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }
}

/** Last N failed AI usage rows (for the security card + health). */
export async function getRecentAiFailures(clinicId: string, limit = 5) {
  const rows = await prisma.aiUsageLog.findMany({
    where: { clinicId, success: false },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, createdAt: true, provider: true, errorCode: true },
  })
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))
}

/** Last N safety-relevant audit events (risk / injection / loop / rate limit). */
export async function getRecentAssistSafetyEvents(clinicId: string, limit = 5) {
  const rows = await prisma.auditLog.findMany({
    where: {
      clinicId,
      action: {
        in: [
          AuditAction.ASSIST_HIGH_RISK_MESSAGE_DETECTED,
          AuditAction.ASSIST_CRITICAL_RISK_MESSAGE_DETECTED,
          AuditAction.ASSIST_PROMPT_INJECTION_DETECTED,
          AuditAction.ASSIST_LOOP_DETECTED,
          AuditAction.ASSIST_RATE_LIMIT_EXCEEDED,
          AuditAction.ASSIST_SENSITIVE_MESSAGE_DETECTED,
        ] as string[],
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, action: true, createdAt: true },
  })
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))
}
