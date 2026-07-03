import "server-only"

import { prisma } from "@/lib/prisma"
import { getClinicTimeZone, clinicToday, getDayRangeUtc } from "@/lib/appointments/date-utils"

interface UsageInput {
  clinicId: string
  conversationId?: string
  provider: "OPENAI" | "RULE_BASED"
  model?: string | null
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number }
  success: boolean
  errorCode?: string
}

// Rough per-token cost (cents) for the default small model, only used for a
// non-authoritative "estimated cost" metric — never billed on.
const COST_PER_INPUT_TOKEN_CENTS = 0.000015
const COST_PER_OUTPUT_TOKEN_CENTS = 0.00006

/** Total tokens the clinic has used TODAY (clinic timezone). */
export async function getTodayTokenTotal(clinicId: string): Promise<number> {
  const settings = await prisma.clinicSettings.findUnique({
    where: { clinicId },
    select: { timezone: true },
  })
  const tz = getClinicTimeZone(settings?.timezone)
  const range = getDayRangeUtc(clinicToday(tz), tz)

  const agg = await prisma.aiUsageLog.aggregate({
    where: { clinicId, provider: "OPENAI", createdAt: { gte: range.start, lt: range.end } },
    _sum: { totalTokens: true },
  })
  return agg._sum.totalTokens ?? 0
}

/** True when today's token usage has reached/exceeded the daily budget. */
export async function isDailyTokenLimitExceeded(clinicId: string, limit: number): Promise<boolean> {
  if (limit <= 0) return false
  const total = await getTodayTokenTotal(clinicId)
  return total >= limit
}

/** Records one usage row (best-effort; never throws into the caller). */
export async function recordAiUsage(input: UsageInput): Promise<void> {
  try {
    const estimatedCostInCents = input.usage
      ? Math.round(
          input.usage.inputTokens * COST_PER_INPUT_TOKEN_CENTS +
            input.usage.outputTokens * COST_PER_OUTPUT_TOKEN_CENTS
        )
      : 0
    await prisma.aiUsageLog.create({
      data: {
        clinicId: input.clinicId,
        conversationId: input.conversationId ?? null,
        provider: input.provider,
        model: input.model ?? null,
        inputTokens: input.usage?.inputTokens ?? null,
        outputTokens: input.usage?.outputTokens ?? null,
        totalTokens: input.usage?.totalTokens ?? null,
        estimatedCostInCents,
        success: input.success,
        errorCode: input.errorCode ?? null,
      },
    })
  } catch {
    // Usage logging must never break the conversation flow.
  }
}
