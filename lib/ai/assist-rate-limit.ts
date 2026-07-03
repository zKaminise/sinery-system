import "server-only"

import { prisma } from "@/lib/prisma"
import { getClinicTimeZone, clinicToday, getDayRangeUtc } from "@/lib/appointments/date-utils"
import {
  decideClinicRateLimit,
  isOverLimit,
  type RateLimitDecision,
} from "@/lib/ai/assist-rate-limit-core"
import type { AiConfig } from "@/lib/ai/config"

const ALLOWED: RateLimitDecision = { allowed: true, reason: null }

function since(seconds: number): Date {
  return new Date(Date.now() - seconds * 1000)
}

/**
 * Clinic-level rate limit (per-minute + per-day), counted from AiUsageLog rows
 * (both rule-based and real-AI turns are recorded). DB-based, no Redis.
 */
export async function checkClinicAiRateLimit(clinicId: string, cfg: AiConfig): Promise<RateLimitDecision> {
  const settings = await prisma.clinicSettings.findUnique({ where: { clinicId }, select: { timezone: true } })
  const tz = getClinicTimeZone(settings?.timezone)
  const dayRange = getDayRangeUtc(clinicToday(tz), tz)

  const [perMinute, perDay] = await Promise.all([
    prisma.aiUsageLog.count({ where: { clinicId, createdAt: { gte: since(60) } } }),
    prisma.aiUsageLog.count({ where: { clinicId, createdAt: { gte: dayRange.start, lt: dayRange.end } } }),
  ])

  return decideClinicRateLimit({
    perMinuteCount: perMinute,
    perMinuteLimit: cfg.rateLimitPerMinute,
    perDayCount: perDay,
    perDayLimit: cfg.rateLimitPerDay,
  })
}

/** Per-conversation per-minute limit — protects a single thread from flooding. */
export async function checkConversationAiRateLimit(
  clinicId: string,
  conversationId: string,
  cfg: AiConfig
): Promise<RateLimitDecision> {
  const count = await prisma.aiUsageLog.count({
    where: { clinicId, conversationId, createdAt: { gte: since(60) } },
  })
  if (isOverLimit(count, cfg.conversationRateLimitPerMinute)) {
    return { allowed: false, reason: "conversation_per_minute" }
  }
  return ALLOWED
}

/** Per-conversation tool-execution rate (loop guard for real-AI tools). */
export async function checkToolRateLimit(
  clinicId: string,
  conversationId: string,
  cfg: AiConfig
): Promise<RateLimitDecision> {
  const count = await prisma.aiUsageLog.count({
    where: { clinicId, conversationId, toolName: { not: null }, createdAt: { gte: since(60) } },
  })
  if (isOverLimit(count, cfg.toolRateLimitPerMinute)) {
    return { allowed: false, reason: "tool_per_minute" }
  }
  return ALLOWED
}

/** Combined clinic + conversation check (used as a preflight gate). */
export async function checkAssistRateLimits(
  clinicId: string,
  conversationId: string,
  cfg: AiConfig
): Promise<RateLimitDecision> {
  const clinic = await checkClinicAiRateLimit(clinicId, cfg)
  if (!clinic.allowed) return clinic
  return checkConversationAiRateLimit(clinicId, conversationId, cfg)
}

/** Calls today (clinic tz) — used by the usage panel + security card. */
export async function getCallsInLastMinute(clinicId: string): Promise<number> {
  return prisma.aiUsageLog.count({ where: { clinicId, createdAt: { gte: since(60) } } })
}
