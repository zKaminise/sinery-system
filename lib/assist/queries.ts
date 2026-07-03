import "server-only"

import { prisma } from "@/lib/prisma"
import type { AssistFlowState, AiTurnMeta } from "@/lib/assist/types"
import { getAssistState, type AssistState } from "@/lib/assist/assist-state"
import { getClinicTimeZone, clinicToday, getDayRangeUtc } from "@/lib/appointments/date-utils"
import { getAiPublicStatus } from "@/lib/ai/config"
import type { ConversationStatus, MessageDirection, MessageSenderType } from "@/lib/generated/prisma/client"

export interface AssistSimulationListItem {
  id: string
  displayName: string
  status: ConversationStatus
  lastMessagePreview: string | null
  lastMessageAt: string | null
  updatedAt: string
}

export interface AssistSimulationMessage {
  id: string
  direction: MessageDirection
  senderType: MessageSenderType
  content: string
  createdAt: string
}

export interface AssistSimulationDetail {
  id: string
  displayName: string
  phone: string | null
  status: ConversationStatus
  patientId: string | null
  patientName: string | null
  flow: AssistFlowState | null
  aiMeta: AiTurnMeta | null
  /** Standardized denormalized assist state (Prompt 14). */
  assist: AssistState
  messages: AssistSimulationMessage[]
}

export interface AssistSummary {
  simulations: number
  aiScheduled: number
  transferredToHuman: number
  aiCallsToday: number
  aiTokensToday: number
}

export interface AssistRuntimeInfo {
  mode: "OPENAI" | "RULE_BASED"
  hasApiKey: boolean
  isMock: boolean
  model: string | null
  useRealAiFlag: boolean
  assistEnabled: boolean
}

export interface AiSettingsData {
  assistantName: string
  enabled: boolean
  tone: string
  fallbackToHuman: boolean
  humanFallbackMessage: string | null
  canAnswerPricing: boolean
  canSchedule: boolean
  canReschedule: boolean
  canCancel: boolean
}

export interface KnowledgeItem {
  id: string
  title: string
  content: string
  active: boolean
}

/**
 * Lists the clinic's Assist simulations — conversations the assistant has
 * spoken in (at least one AI message). Ordered most-recent first.
 */
export async function getAssistSimulations(clinicId: string): Promise<AssistSimulationListItem[]> {
  const rows = await prisma.conversation.findMany({
    where: { clinicId, messages: { some: { senderType: "AI" } } },
    orderBy: { updatedAt: "desc" },
    take: 30,
    select: {
      id: true,
      status: true,
      contactName: true,
      updatedAt: true,
      patient: { select: { name: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { content: true, createdAt: true } },
    },
  })

  return rows.map((c) => {
    const last = c.messages[0]
    return {
      id: c.id,
      displayName: c.patient?.name ?? c.contactName ?? "Contato sem nome",
      status: c.status,
      lastMessagePreview: last?.content ?? null,
      lastMessageAt: last?.createdAt.toISOString() ?? null,
      updatedAt: c.updatedAt.toISOString(),
    }
  })
}

/** One simulation with full message history + current flow state (tenant-scoped). */
export async function getAssistSimulationDetail(
  clinicId: string,
  conversationId: string
): Promise<AssistSimulationDetail | null> {
  const conv = await prisma.conversation.findFirst({
    where: { id: conversationId, clinicId },
    select: {
      id: true,
      status: true,
      contactName: true,
      contactPhone: true,
      metadata: true,
      patient: { select: { id: true, name: true, phone: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        select: { id: true, direction: true, senderType: true, content: true, createdAt: true },
      },
    },
  })
  if (!conv) return null

  const meta = (conv.metadata ?? null) as { assistFlow?: AssistFlowState; aiMeta?: AiTurnMeta } | null

  return {
    id: conv.id,
    displayName: conv.patient?.name ?? conv.contactName ?? "Contato sem nome",
    phone: conv.patient?.phone ?? conv.contactPhone ?? null,
    status: conv.status,
    patientId: conv.patient?.id ?? null,
    patientName: conv.patient?.name ?? null,
    flow: meta?.assistFlow ?? null,
    aiMeta: meta?.aiMeta ?? null,
    assist: getAssistState(conv.metadata, conv.patient?.id ?? null),
    messages: conv.messages.map((m) => ({
      id: m.id,
      direction: m.direction,
      senderType: m.senderType,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
  }
}

/** Summary counts for the /assist header cards. */
export async function getAssistSummary(clinicId: string): Promise<AssistSummary> {
  const settings = await prisma.clinicSettings.findUnique({ where: { clinicId }, select: { timezone: true } })
  const tz = getClinicTimeZone(settings?.timezone)
  const todayRange = getDayRangeUtc(clinicToday(tz), tz)

  const [simulations, aiScheduled, transferredToHuman, usage] = await Promise.all([
    prisma.conversation.count({ where: { clinicId, messages: { some: { senderType: "AI" } } } }),
    prisma.appointment.count({ where: { clinicId, createdBySource: "AI" } }),
    prisma.auditLog.count({ where: { clinicId, action: "ASSIST_TRANSFERRED_TO_HUMAN" } }),
    prisma.aiUsageLog.aggregate({
      where: { clinicId, provider: "OPENAI", createdAt: { gte: todayRange.start, lt: todayRange.end } },
      _count: true,
      _sum: { totalTokens: true },
    }),
  ])
  return {
    simulations,
    aiScheduled,
    transferredToHuman,
    aiCallsToday: usage._count,
    aiTokensToday: usage._sum.totalTokens ?? 0,
  }
}

/** Runtime AI status shown on /assist — never exposes the API key value. */
export async function getAssistRuntimeInfo(clinicId: string): Promise<AssistRuntimeInfo> {
  const status = getAiPublicStatus()
  const s = await prisma.aiSettings.findUnique({ where: { clinicId }, select: { enabled: true } })
  return {
    mode: status.mode,
    hasApiKey: status.hasApiKey,
    isMock: status.isMock,
    model: status.model,
    useRealAiFlag: status.useRealAiFlag,
    assistEnabled: s?.enabled ?? false,
  }
}

/** Current AiSettings for the clinic (defaults if none exist yet). */
export async function getAiSettings(clinicId: string): Promise<AiSettingsData> {
  const s = await prisma.aiSettings.findUnique({ where: { clinicId } })
  return {
    assistantName: s?.assistantName ?? "Sinery Assist",
    enabled: s?.enabled ?? false,
    tone: s?.tone ?? "professional",
    fallbackToHuman: s?.fallbackToHuman ?? true,
    humanFallbackMessage: s?.humanFallbackMessage ?? null,
    canAnswerPricing: s?.canAnswerPricing ?? false,
    canSchedule: s?.canSchedule ?? false,
    canReschedule: s?.canReschedule ?? false,
    canCancel: s?.canCancel ?? false,
  }
}

/** All knowledge base items for the clinic (active first, then by title). */
export async function getKnowledgeBase(clinicId: string): Promise<KnowledgeItem[]> {
  const rows = await prisma.aiKnowledgeBase.findMany({
    where: { clinicId },
    orderBy: [{ active: "desc" }, { title: "asc" }],
    select: { id: true, title: true, content: true, active: true },
  })
  return rows
}

/** Patients available to attach to a new simulation (non-archived). */
export async function getAssistPatients(clinicId: string): Promise<{ id: string; name: string }[]> {
  return prisma.patient.findMany({
    where: { clinicId, status: { not: "ARCHIVED" } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  })
}
