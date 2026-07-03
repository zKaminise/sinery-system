import "server-only"

import { prisma } from "@/lib/prisma"
import { getAiConfig, getAiPublicStatus } from "@/lib/ai/config"
import {
  getAiUsageSummary,
  getRecentAiFailures,
  getRecentAssistSafetyEvents,
  type AiUsageSummary,
} from "@/lib/ai/assist-usage-queries"
import { getCallsInLastMinute } from "@/lib/ai/assist-rate-limit"
import { getTodayTokenTotal } from "@/lib/ai/assist-cost-control"

export type AssistBadge =
  | "OK"
  | "ATTENTION"
  | "NEAR_LIMIT"
  | "DISABLED"
  | "NO_API_KEY"
  | "USING_SIMULATOR"
  | "USING_REAL_AI"

export interface AssistSecurityOverview {
  effectiveMode: "OPENAI" | "RULE_BASED" | "DISABLED"
  hasApiKey: boolean
  isMock: boolean
  model: string | null
  globalDisabled: boolean
  clinicEnabled: boolean
  dailyTokenLimit: number
  rateLimitPerMinute: number
  rateLimitPerDay: number
  tokensToday: number
  callsLastMinute: number
  summary: AiUsageSummary
  recentFailures: { id: string; createdAt: string; provider: string; errorCode: string | null }[]
  recentSafetyEvents: { id: string; action: string; createdAt: string }[]
  badges: AssistBadge[]
}

/** Aggregates everything the "Segurança e uso" card needs (no external call). */
export async function getAssistSecurityOverview(clinicId: string): Promise<AssistSecurityOverview> {
  const cfg = getAiConfig()
  const pub = getAiPublicStatus()

  const [aiSettings, summary, callsLastMinute, tokensToday, recentFailures, recentSafetyEvents] = await Promise.all([
    prisma.aiSettings.findUnique({ where: { clinicId }, select: { enabled: true } }),
    getAiUsageSummary(clinicId),
    getCallsInLastMinute(clinicId),
    getTodayTokenTotal(clinicId),
    getRecentAiFailures(clinicId, 5),
    getRecentAssistSafetyEvents(clinicId, 5),
  ])

  const clinicEnabled = aiSettings?.enabled ?? false

  const badges: AssistBadge[] = []
  if (cfg.globalDisabled) badges.push("DISABLED")
  else if (!clinicEnabled) badges.push("DISABLED")
  else {
    badges.push(cfg.useRealAi ? "USING_REAL_AI" : "USING_SIMULATOR")
    if (cfg.useRealAi && !cfg.hasApiKey) badges.push("NO_API_KEY")
    // Near-limit warning at >=80% of the daily token budget.
    if (cfg.dailyTokenLimit > 0 && tokensToday >= cfg.dailyTokenLimit * 0.8) badges.push("NEAR_LIMIT")
    if (summary.errorToday > 0) badges.push("ATTENTION")
    if (badges.length === 1) badges.push("OK")
  }
  if (cfg.useRealAi && !cfg.hasApiKey && !badges.includes("NO_API_KEY")) badges.push("NO_API_KEY")

  return {
    effectiveMode: pub.effectiveMode,
    hasApiKey: cfg.hasApiKey,
    isMock: cfg.isMock,
    model: cfg.useRealAi ? cfg.model : null,
    globalDisabled: cfg.globalDisabled,
    clinicEnabled,
    dailyTokenLimit: cfg.dailyTokenLimit,
    rateLimitPerMinute: cfg.rateLimitPerMinute,
    rateLimitPerDay: cfg.rateLimitPerDay,
    tokensToday,
    callsLastMinute,
    summary,
    recentFailures,
    recentSafetyEvents,
    badges,
  }
}
