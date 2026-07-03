import "server-only"

import { prisma } from "@/lib/prisma"
import { getClinicTimeZone, clinicToday } from "@/lib/appointments/date-utils"
import { getUpcomingActiveAppointments } from "@/lib/assist/appointment-helpers"
import type { AssistModelMessage } from "@/lib/ai/openai-client"
import type { AssistFlowState } from "@/lib/assist/types"

export interface AiAssistContext {
  clinicId: string
  conversationId: string
  timeZone: string
  today: string
  clinic: {
    name: string
    segment: string
    address: string | null
    city: string | null
    state: string | null
    phone: string | null
    whatsapp: string | null
  }
  hours: { start: number; end: number } | null
  aiSettings: {
    assistantName: string
    tone: string
    enabled: boolean
    canAnswerPricing: boolean
    canSchedule: boolean
    canReschedule: boolean
    canCancel: boolean
    humanFallbackMessage: string | null
  }
  services: { id: string; name: string; durationMinutes: number; priceInCents: number | null; professionals: string[] }[]
  professionals: { id: string; name: string; specialty: string | null }[]
  knowledge: { title: string; content: string }[]
  patient:
    | { id: string; name: string; phone: string; upcoming: { serviceName: string | null; date: string; time: string }[] }
    | null
  history: AssistModelMessage[]
  flow: AssistFlowState | null
}

/**
 * Builds a SAFE context for the AI: only clinic-public + operational data.
 * Explicitly excludes secrets, tokens, audit logs, other patients, and clinical
 * notes. Returns null if the conversation isn't in this clinic (→ 404 upstream).
 */
export async function buildAiAssistContext(
  clinicId: string,
  conversationId: string,
  maxHistory: number
): Promise<AiAssistContext | null> {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, clinicId },
    select: {
      id: true,
      metadata: true,
      patient: { select: { id: true, name: true, phone: true } },
    },
  })
  if (!conversation) return null

  const [clinic, settings, aiSettings, services, professionals, knowledge, messages] = await Promise.all([
    prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { name: true, segment: true, address: true, city: true, state: true, phone: true, whatsapp: true },
    }),
    prisma.clinicSettings.findUnique({
      where: { clinicId },
      select: { timezone: true, businessStartHour: true, businessEndHour: true },
    }),
    prisma.aiSettings.findUnique({
      where: { clinicId },
      select: {
        assistantName: true,
        tone: true,
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
      select: {
        id: true,
        name: true,
        durationMinutes: true,
        priceInCents: true,
        professionals: {
          where: { professional: { status: "ACTIVE" } },
          select: { professional: { select: { name: true } } },
        },
      },
    }),
    prisma.professional.findMany({
      where: { clinicId, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, specialty: true },
    }),
    prisma.aiKnowledgeBase.findMany({
      where: { clinicId, active: true },
      orderBy: { createdAt: "asc" },
      select: { title: true, content: true },
    }),
    prisma.message.findMany({
      where: { clinicId, conversationId },
      orderBy: { createdAt: "desc" },
      take: maxHistory,
      select: { senderType: true, content: true },
    }),
  ])

  const timeZone = getClinicTimeZone(settings?.timezone)
  const meta = (conversation.metadata ?? null) as { assistFlow?: AssistFlowState } | null

  // Patient upcoming appointments (only if the conversation is tied to one).
  let patient: AiAssistContext["patient"] = null
  if (conversation.patient) {
    const upcoming = await getUpcomingActiveAppointments(clinicId, conversation.patient.id, timeZone)
    patient = {
      id: conversation.patient.id,
      name: conversation.patient.name,
      phone: conversation.patient.phone,
      upcoming: upcoming.map((u) => ({ serviceName: u.serviceName, date: u.date, time: u.startTime })),
    }
  }

  // Recent history in chronological order, patient→user / assistant→assistant.
  const history: AssistModelMessage[] = messages
    .reverse()
    .filter((m) => m.senderType === "PATIENT" || m.senderType === "AI")
    .map((m) => ({ role: m.senderType === "PATIENT" ? ("user" as const) : ("assistant" as const), content: m.content }))

  return {
    clinicId,
    conversationId: conversation.id,
    timeZone,
    today: clinicToday(timeZone),
    clinic: {
      name: clinic?.name ?? "",
      segment: clinic?.segment ?? "OTHER",
      address: clinic?.address ?? null,
      city: clinic?.city ?? null,
      state: clinic?.state ?? null,
      phone: clinic?.phone ?? null,
      whatsapp: clinic?.whatsapp ?? null,
    },
    hours:
      settings?.businessStartHour != null && settings?.businessEndHour != null
        ? { start: settings.businessStartHour, end: settings.businessEndHour }
        : null,
    aiSettings: {
      assistantName: aiSettings?.assistantName ?? "Sinery Assist",
      tone: aiSettings?.tone ?? "professional",
      enabled: aiSettings?.enabled ?? false,
      canAnswerPricing: aiSettings?.canAnswerPricing ?? false,
      canSchedule: aiSettings?.canSchedule ?? false,
      canReschedule: aiSettings?.canReschedule ?? false,
      canCancel: aiSettings?.canCancel ?? false,
      humanFallbackMessage: aiSettings?.humanFallbackMessage ?? null,
    },
    services: services.map((s) => ({
      id: s.id,
      name: s.name,
      durationMinutes: s.durationMinutes,
      priceInCents: s.priceInCents,
      professionals: s.professionals.map((p) => p.professional.name),
    })),
    professionals: professionals.map((p) => ({ id: p.id, name: p.name, specialty: p.specialty })),
    knowledge: knowledge.map((k) => ({ title: k.title, content: k.content })),
    patient,
    history,
    flow: meta?.assistFlow ?? null,
  }
}
