import "server-only"

import { prisma } from "@/lib/prisma"
import { getClinicTimeZone, clinicToday, getDayRangeUtc } from "@/lib/appointments/date-utils"
import { estimateAiCostInCents } from "@/lib/ai/assist-cost"

interface UsageInput {
  clinicId: string
  conversationId?: string
  provider: "OPENAI" | "RULE_BASED"
  mode?: string | null
  model?: string | null
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number }
  success: boolean
  errorCode?: string
  errorMessage?: string
  latencyMs?: number
  toolName?: string
}

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

/** Truncates + strips anything that could leak a key/prompt from an error string. */
function sanitizeErrorMessage(raw: string | undefined): string | null {
  if (!raw) return null
  return raw
    .replace(/sk-[a-zA-Z0-9_-]+/g, "[redacted-key]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .slice(0, 300)
}

/**
 * Records one usage row (best-effort; never throws into the caller). Stores
 * mode/latency/tool/sanitized error and a NON-authoritative estimated cost.
 * Never stores the API key, the prompt, or the raw provider payload.
 */
export async function recordAiUsage(input: UsageInput): Promise<void> {
  try {
    const estimatedCostInCents = estimateAiCostInCents({
      model: input.provider === "RULE_BASED" ? "mock" : input.model,
      inputTokens: input.usage?.inputTokens,
      outputTokens: input.usage?.outputTokens,
    })
    await prisma.aiUsageLog.create({
      data: {
        clinicId: input.clinicId,
        conversationId: input.conversationId ?? null,
        provider: input.provider,
        mode: input.mode ?? input.provider,
        model: input.model ?? null,
        inputTokens: input.usage?.inputTokens ?? null,
        outputTokens: input.usage?.outputTokens ?? null,
        totalTokens: input.usage?.totalTokens ?? null,
        estimatedCostInCents,
        success: input.success,
        errorCode: input.errorCode ?? null,
        errorMessage: sanitizeErrorMessage(input.errorMessage),
        latencyMs: input.latencyMs ?? null,
        toolName: input.toolName ?? null,
      },
    })
  } catch {
    // Usage logging must never break the conversation flow.
  }
}
