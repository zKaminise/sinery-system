import "server-only"

import { prisma } from "@/lib/prisma"
import { getClinicTimeZone } from "@/lib/appointments/date-utils"
import type { AssistFlowState, AssistTurn, AssistReplyMessage } from "@/lib/assist/types"
import { AuditAction } from "@/lib/audit-actions"

export interface AssistContext {
  clinicId: string
  conversationId: string
  timeZone: string
  text: string
  clinic: { name: string; address: string | null; city: string | null; state: string | null }
  settings: { businessStartHour: number | null; businessEndHour: number | null; appointmentSlotMinutes: number }
  aiSettings: {
    assistantName: string
    enabled: boolean
    canAnswerPricing: boolean
    canSchedule: boolean
    canReschedule: boolean
    canCancel: boolean
    humanFallbackMessage: string | null
  }
  patient: { id: string; name: string } | null
  services: { id: string; name: string; priceInCents: number | null }[]
  knowledge: { title: string; content: string }[]
  flow: AssistFlowState | null
}

/**
 * Loads everything the deterministic assistant needs to process one message,
 * scoped to `clinicId`. Returns null if the conversation doesn't belong to the
 * clinic (caller turns that into a 404 — never revealing cross-clinic data).
 */
export async function loadAssistContext(
  clinicId: string,
  conversationId: string,
  text: string
): Promise<AssistContext | null> {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, clinicId },
    select: {
      id: true,
      metadata: true,
      patient: { select: { id: true, name: true } },
    },
  })
  if (!conversation) return null

  const [clinic, settings, aiSettings, services, knowledge] = await Promise.all([
    prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { name: true, address: true, city: true, state: true },
    }),
    prisma.clinicSettings.findUnique({
      where: { clinicId },
      select: { timezone: true, businessStartHour: true, businessEndHour: true, appointmentSlotMinutes: true },
    }),
    prisma.aiSettings.findUnique({
      where: { clinicId },
      select: {
        assistantName: true,
        enabled: true,
        canAnswerPricing: true,
        canSchedule: true,
        canReschedule: true,
        canCancel: true,
        humanFallbackMessage: true,
      },
    }),
    prisma.service.findMany({
      where: { clinicId, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, priceInCents: true },
    }),
    prisma.aiKnowledgeBase.findMany({
      where: { clinicId, active: true },
      orderBy: { createdAt: "asc" },
      select: { title: true, content: true },
    }),
  ])

  const meta = (conversation.metadata ?? null) as { assistFlow?: AssistFlowState } | null

  return {
    clinicId,
    conversationId: conversation.id,
    timeZone: getClinicTimeZone(settings?.timezone),
    text,
    clinic: {
      name: clinic?.name ?? "",
      address: clinic?.address ?? null,
      city: clinic?.city ?? null,
      state: clinic?.state ?? null,
    },
    settings: {
      businessStartHour: settings?.businessStartHour ?? null,
      businessEndHour: settings?.businessEndHour ?? null,
      appointmentSlotMinutes: settings?.appointmentSlotMinutes ?? 30,
    },
    aiSettings: {
      assistantName: aiSettings?.assistantName ?? "Sinery Assist",
      enabled: aiSettings?.enabled ?? false,
      canAnswerPricing: aiSettings?.canAnswerPricing ?? false,
      canSchedule: aiSettings?.canSchedule ?? false,
      canReschedule: aiSettings?.canReschedule ?? false,
      canCancel: aiSettings?.canCancel ?? false,
      humanFallbackMessage: aiSettings?.humanFallbackMessage ?? null,
    },
    patient: conversation.patient,
    services,
    knowledge,
    flow: meta?.assistFlow ?? null,
  }
}

/** Convenience builder for a single AI reply message. */
export function aiReply(content: string): AssistReplyMessage {
  return { senderType: "AI", content }
}

/** Convenience builder for a system message. */
export function systemMessage(content: string): AssistReplyMessage {
  return { senderType: "SYSTEM", content }
}

/**
 * Builds a "transfer to human" turn: an AI apology + a SYSTEM note, status
 * WAITING_HUMAN, flow marked TRANSFERRED_TO_HUMAN, and the audit entry.
 */
export function transferToHuman(ctx: AssistContext, aiMessage: string, reason: string): AssistTurn {
  return {
    replies: [
      aiReply(aiMessage),
      systemMessage("Conversa transferida para atendimento humano pela Sinery Assist."),
    ],
    flow: ctx.flow
      ? { ...ctx.flow, step: "TRANSFERRED_TO_HUMAN" }
      : { intent: "HUMAN_HELP", step: "TRANSFERRED_TO_HUMAN" },
    status: "WAITING_HUMAN",
    audits: [
      {
        action: AuditAction.ASSIST_TRANSFERRED_TO_HUMAN,
        description: "A Sinery Assist transferiu a conversa para atendimento humano.",
        metadata: { conversationId: ctx.conversationId, reason },
      },
    ],
  }
}
