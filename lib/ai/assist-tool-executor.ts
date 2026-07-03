import "server-only"

import { prisma } from "@/lib/prisma"
import { AuditAction } from "@/lib/audit-actions"
import { clinicToday } from "@/lib/appointments/date-utils"
import { isTerminalStatus } from "@/lib/appointments/availability"
import { validateAndResolveAppointment } from "@/lib/appointments/validate-appointment"
import { findAvailableSlots } from "@/lib/assist/available-slots"
import { getUpcomingActiveAppointments } from "@/lib/assist/appointment-helpers"
import { normalize } from "@/lib/assist/intent-detector"
import { getAiConfig } from "@/lib/ai/config"
import type { AiAssistContext } from "@/lib/ai/assist-context"
import { ASSIST_TOOLS, isKnownTool } from "@/lib/ai/assist-tools"
import { toolArgSchemas } from "@/lib/ai/assist-schemas"
import type {
  AssistReplyMessage,
  AssistFlowState,
  AssistAuditEntry,
  AssistSlot,
} from "@/lib/assist/types"
import type { ConversationStatus } from "@/lib/generated/prisma/client"

export interface ToolExecution {
  ok: boolean
  toolName: string
  resultSummary: string
  replies: AssistReplyMessage[]
  /** undefined = don't touch flow; null = clear it. */
  flow?: AssistFlowState | null
  status?: ConversationStatus
  audits: AssistAuditEntry[]
  transferred: boolean
}

function ai(content: string): AssistReplyMessage {
  return { senderType: "AI", content }
}
function sys(content: string): AssistReplyMessage {
  return { senderType: "SYSTEM", content }
}

function dateLabel(dateStr: string, today: string): string {
  const [ty, tm, td] = today.split("-").map(Number)
  const tomorrow = new Date(Date.UTC(ty, tm - 1, td) + 86_400_000)
  const tomorrowStr = `${tomorrow.getUTCFullYear()}-${String(tomorrow.getUTCMonth() + 1).padStart(2, "0")}-${String(tomorrow.getUTCDate()).padStart(2, "0")}`
  if (dateStr === today) return "hoje"
  if (dateStr === tomorrowStr) return "amanhã"
  const [, m, d] = dateStr.split("-")
  return `${d}/${m}`
}

function transfer(toolName: string, ctx: AiAssistContext, message: string, reason: string): ToolExecution {
  return {
    ok: true,
    toolName,
    resultSummary: `transferido para humano (${reason})`,
    replies: [ai(message), sys("Conversa transferida para atendimento humano pela Sinery Assist.")],
    status: "WAITING_HUMAN",
    flow: { intent: "HUMAN_HELP", step: "TRANSFERRED_TO_HUMAN" },
    audits: [
      {
        action: AuditAction.ASSIST_TRANSFERRED_TO_HUMAN,
        description: "A Sinery Assist transferiu a conversa para atendimento humano.",
        metadata: { conversationId: ctx.conversationId, reason },
      },
    ],
    transferred: true,
  }
}

function fail(toolName: string, ctx: AiAssistContext, reason: string): ToolExecution {
  return {
    ...transfer(
      toolName,
      ctx,
      ctx.aiSettings.humanFallbackMessage ??
        "Tive uma dificuldade para concluir isso agora. Vou chamar alguém da equipe para te ajudar.",
      reason
    ),
    ok: false,
  }
}

/** Hard block for a tool that must not run (unknown/closed/disabled). */
function blocked(toolName: string, ctx: AiAssistContext, reason: string): ToolExecution {
  return {
    ok: false,
    toolName,
    resultSummary: `ferramenta bloqueada (${reason})`,
    replies: [
      ai(
        ctx.aiSettings.humanFallbackMessage ??
          "Não consigo concluir essa ação automática agora. Vou chamar alguém da equipe para te ajudar."
      ),
      sys("Ação automática bloqueada por segurança — transferida para atendimento humano."),
    ],
    status: "WAITING_HUMAN",
    flow: { intent: "HUMAN_HELP", step: "TRANSFERRED_TO_HUMAN" },
    audits: [
      {
        action: AuditAction.ASSIST_TOOL_BLOCKED,
        description: `Ferramenta ${toolName} bloqueada (${reason}).`,
        metadata: { conversationId: ctx.conversationId, tool: toolName, reason },
      },
      {
        action: AuditAction.ASSIST_TRANSFERRED_TO_HUMAN,
        description: "A Sinery Assist transferiu a conversa para atendimento humano.",
        metadata: { conversationId: ctx.conversationId, reason: `tool_blocked_${reason}` },
      },
    ],
    transferred: true,
  }
}

function resolveServiceId(ctx: AiAssistContext, args: { serviceId?: string; serviceName?: string }): string | null {
  if (args.serviceId && ctx.services.some((s) => s.id === args.serviceId)) return args.serviceId
  if (args.serviceName) {
    const q = normalize(args.serviceName)
    const match =
      ctx.services.find((s) => normalize(s.name) === q) ??
      ctx.services.find((s) => normalize(s.name).includes(q) || q.includes(normalize(s.name)))
    if (match) return match.id
  }
  return null
}

/**
 * Runs one AI-requested tool safely. Enforces the allow-list, Zod-validates
 * arguments, checks AiSettings capability + patient requirements, executes the
 * tenant-scoped operation, and returns a turn fragment (replies/flow/status/
 * audits). Never touches another clinic's data; the conversation's own patient
 * is always used (the model's patientId is ignored).
 */
export async function executeAssistTool(
  ctx: AiAssistContext,
  toolName: string,
  rawArgs: Record<string, unknown>
): Promise<ToolExecution> {
  // Hardening: block before doing anything if the environment/clinic forbids
  // automation, the tool is unknown, or the conversation is closed.
  const cfg = getAiConfig()
  if (cfg.globalDisabled) return blocked(toolName, ctx, "global_disabled")
  if (!ctx.aiSettings.enabled) return blocked(toolName, ctx, "clinic_disabled")
  if (!isKnownTool(toolName)) return blocked(toolName, ctx, "unknown_tool")

  const conv = await prisma.conversation.findFirst({
    where: { id: ctx.conversationId, clinicId: ctx.clinicId },
    select: { status: true },
  })
  if (!conv) return blocked(toolName, ctx, "conversation_not_found")
  if (conv.status === "CLOSED") return blocked(toolName, ctx, "conversation_closed")

  const meta = ASSIST_TOOLS[toolName]

  const schema = toolArgSchemas[toolName]
  const parsed = schema.safeParse(rawArgs)
  if (!parsed.success) {
    return fail(toolName, ctx, "invalid_arguments")
  }
  const args = parsed.data as Record<string, unknown>

  // Capability + patient gating.
  if (meta.requiresCapability && !ctx.aiSettings[meta.requiresCapability]) {
    return transfer(toolName, ctx, capabilityMessage(meta.requiresCapability), `capability_${meta.requiresCapability}_off`)
  }
  if (meta.requiresPatient && !ctx.patient) {
    return transfer(
      toolName,
      ctx,
      "Para isso preciso que a conversa esteja vinculada a um paciente cadastrado. Vou chamar alguém da equipe.",
      "no_patient"
    )
  }

  const today = clinicToday(ctx.timeZone)

  switch (toolName) {
    case "getClinicInfo": {
      const loc = [ctx.clinic.address, [ctx.clinic.city, ctx.clinic.state].filter(Boolean).join(" - ")]
        .filter(Boolean)
        .join(", ")
      if (!loc) return transfer(toolName, ctx, "Ainda não encontrei o endereço cadastrado. Vou chamar alguém da equipe.", "address_missing")
      const hours = ctx.hours ? ` Atendemos das ${ctx.hours.start}h às ${ctx.hours.end}h, de segunda a sexta.` : ""
      return {
        ok: true,
        toolName,
        resultSummary: "informações da clínica",
        replies: [ai(`A ${ctx.clinic.name} fica em: ${loc}.${hours} Posso ajudar com mais alguma coisa?`)],
        flow: null,
        audits: [],
        transferred: false,
      }
    }

    case "listActiveServices": {
      const names = ctx.services.map((s) => s.name).join(", ") || "nenhum serviço cadastrado"
      return {
        ok: true,
        toolName,
        resultSummary: "serviços ativos",
        replies: [ai(`Oferecemos: ${names}. Sobre qual você gostaria de saber mais?`)],
        flow: null,
        audits: [],
        transferred: false,
      }
    }

    case "findAvailableSlots": {
      const a = args as { serviceId?: string; serviceName?: string; date: string; limit?: number }
      const serviceId = resolveServiceId(ctx, a)
      if (!serviceId) {
        const names = ctx.services.map((s) => s.name).join(", ")
        return {
          ok: true,
          toolName,
          resultSummary: "serviço não identificado",
          replies: [ai(`Não identifiquei o serviço. Temos: ${names}. Qual você deseja?`)],
          flow: { intent: "SCHEDULE_APPOINTMENT", step: "WAITING_SERVICE", detectedDate: a.date },
          audits: [],
          transferred: false,
        }
      }
      const service = ctx.services.find((s) => s.id === serviceId)!
      const result = await findAvailableSlots({ clinicId: ctx.clinicId, serviceId, date: a.date, limit: a.limit ?? 3 })
      if (result.slots.length === 0) {
        return {
          ok: true,
          toolName,
          resultSummary: "sem horários",
          replies: [ai(`Não encontrei horários para ${service.name} em ${dateLabel(a.date, today)}. Quer tentar outro dia?`)],
          flow: { intent: "SCHEDULE_APPOINTMENT", step: "WAITING_DATE", detectedServiceId: serviceId, detectedServiceName: service.name },
          audits: [],
          transferred: false,
        }
      }
      const slots: AssistSlot[] = result.slots.map((s) => ({
        index: s.option,
        professionalId: s.professionalId,
        professionalName: s.professionalName,
        serviceId: s.serviceId,
        serviceName: s.serviceName,
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
      }))
      const lines = slots.map((s) => `${s.index}. ${s.startTime} com ${s.professionalName}`).join("\n")
      return {
        ok: true,
        toolName,
        resultSummary: `${slots.length} horário(s)`,
        replies: [ai(`Encontrei estes horários para ${service.name} em ${dateLabel(a.date, today)}:\n${lines}\n\nResponda com o número da opção desejada.`)],
        flow: {
          intent: "SCHEDULE_APPOINTMENT",
          step: "WAITING_SLOT_SELECTION",
          detectedServiceId: serviceId,
          detectedServiceName: service.name,
          detectedDate: a.date,
          suggestedSlots: slots,
        },
        audits: [],
        transferred: false,
      }
    }

    case "createAppointment": {
      const a = args as { professionalId: string; serviceId: string; date: string; startTime: string; endTime: string }
      // Never trust the model's patientId — always the conversation's patient.
      const validation = await validateAndResolveAppointment({
        clinicId: ctx.clinicId,
        patientId: ctx.patient!.id,
        professionalId: a.professionalId,
        serviceId: a.serviceId,
        date: a.date,
        startTime: a.startTime,
        endTime: a.endTime,
      })
      if (!validation.ok) {
        return {
          ok: false,
          toolName,
          resultSummary: `falha: ${validation.message}`,
          replies: [ai("Esse horário não está mais disponível. Quer que eu verifique outras opções?")],
          flow: { intent: "SCHEDULE_APPOINTMENT", step: "WAITING_DATE", detectedServiceId: a.serviceId },
          audits: [],
          transferred: false,
        }
      }
      const appt = await prisma.appointment.create({
        data: {
          clinicId: ctx.clinicId,
          patientId: ctx.patient!.id,
          professionalId: a.professionalId,
          serviceId: validation.serviceId,
          title: validation.title,
          startAt: validation.startAt,
          endAt: validation.endAt,
          status: "SCHEDULED",
          createdByUserId: null,
          createdBySource: "AI",
        },
        select: { id: true },
      })
      return {
        ok: true,
        toolName,
        resultSummary: "consulta criada",
        replies: [ai(`Perfeito! Sua consulta foi agendada para ${dateLabel(a.date, today)} às ${a.startTime}.`)],
        flow: { intent: "SCHEDULE_APPOINTMENT", step: "COMPLETED" },
        audits: [
          {
            action: AuditAction.ASSIST_APPOINTMENT_CREATED,
            description: "Consulta criada pela Sinery Assist (IA).",
            metadata: { conversationId: ctx.conversationId, appointmentId: appt.id, patientId: ctx.patient!.id },
          },
          {
            action: AuditAction.APPOINTMENT_CREATED,
            description: `Consulta de ${ctx.patient!.name} foi criada (via Sinery Assist).`,
            metadata: { appointmentId: appt.id, patientId: ctx.patient!.id, source: "AI" },
          },
        ],
        transferred: false,
      }
    }

    case "findPatientUpcomingAppointments": {
      const upcoming = await getUpcomingActiveAppointments(ctx.clinicId, ctx.patient!.id, ctx.timeZone)
      if (upcoming.length === 0) {
        return {
          ok: true,
          toolName,
          resultSummary: "sem consultas",
          replies: [ai("Não encontrei consultas futuras em aberto para você.")],
          flow: null,
          audits: [],
          transferred: false,
        }
      }
      const lines = upcoming
        .map((u) => `- ${u.serviceName ?? "consulta"} em ${dateLabel(u.date, today)} às ${u.startTime}`)
        .join("\n")
      return {
        ok: true,
        toolName,
        resultSummary: `${upcoming.length} consulta(s)`,
        replies: [ai(`Suas próximas consultas:\n${lines}`)],
        flow: null,
        audits: [],
        transferred: false,
      }
    }

    case "cancelAppointment": {
      const a = args as { appointmentId: string }
      const existing = await prisma.appointment.findFirst({
        where: { id: a.appointmentId, clinicId: ctx.clinicId, patientId: ctx.patient!.id },
        select: { id: true, status: true },
      })
      if (!existing || isTerminalStatus(existing.status)) {
        return transfer(toolName, ctx, "Não consegui localizar uma consulta cancelável. Vou chamar alguém da equipe.", "cancel_not_found")
      }
      await prisma.appointment.update({ where: { id: existing.id }, data: { status: "CANCELLED" } })
      return {
        ok: true,
        toolName,
        resultSummary: "consulta cancelada",
        replies: [ai("Pronto! Sua consulta foi cancelada. Posso ajudar com mais alguma coisa?")],
        flow: { intent: "CANCEL_APPOINTMENT", step: "COMPLETED" },
        audits: [
          {
            action: AuditAction.ASSIST_APPOINTMENT_CANCELLED,
            description: "Consulta cancelada pela Sinery Assist (IA).",
            metadata: { conversationId: ctx.conversationId, appointmentId: existing.id, patientId: ctx.patient!.id },
          },
        ],
        transferred: false,
      }
    }

    case "confirmAppointment": {
      const a = args as { appointmentId: string }
      const existing = await prisma.appointment.findFirst({
        where: { id: a.appointmentId, clinicId: ctx.clinicId, patientId: ctx.patient!.id, status: { in: ["SCHEDULED", "RESCHEDULED"] } },
        select: { id: true },
      })
      if (!existing) {
        return transfer(toolName, ctx, "Não encontrei uma consulta pendente de confirmação. Vou chamar alguém da equipe.", "confirm_not_found")
      }
      await prisma.appointment.update({ where: { id: existing.id }, data: { status: "CONFIRMED" } })
      return {
        ok: true,
        toolName,
        resultSummary: "consulta confirmada",
        replies: [ai("Consulta confirmada com sucesso. Esperamos você!")],
        flow: { intent: "CONFIRM_APPOINTMENT", step: "COMPLETED" },
        audits: [
          {
            action: AuditAction.ASSIST_APPOINTMENT_CONFIRMED,
            description: "Consulta confirmada pela Sinery Assist (IA).",
            metadata: { conversationId: ctx.conversationId, appointmentId: existing.id, patientId: ctx.patient!.id },
          },
        ],
        transferred: false,
      }
    }

    case "rescheduleAppointment": {
      const a = args as { appointmentId: string; professionalId: string; serviceId: string; date: string; startTime: string; endTime: string }
      const existing = await prisma.appointment.findFirst({
        where: { id: a.appointmentId, clinicId: ctx.clinicId, patientId: ctx.patient!.id },
        select: { id: true, status: true },
      })
      if (!existing || isTerminalStatus(existing.status)) {
        return transfer(toolName, ctx, "Não consegui localizar uma consulta para remarcar. Vou chamar alguém da equipe.", "reschedule_not_found")
      }
      const validation = await validateAndResolveAppointment({
        clinicId: ctx.clinicId,
        patientId: ctx.patient!.id,
        professionalId: a.professionalId,
        serviceId: a.serviceId,
        date: a.date,
        startTime: a.startTime,
        endTime: a.endTime,
        excludeAppointmentId: existing.id,
      })
      if (!validation.ok) {
        return transfer(toolName, ctx, "Esse horário não está mais disponível. Vou chamar alguém da equipe para concluir a remarcação.", "reschedule_slot_taken")
      }
      await prisma.appointment.update({
        where: { id: existing.id },
        data: { professionalId: a.professionalId, serviceId: validation.serviceId, startAt: validation.startAt, endAt: validation.endAt, status: "RESCHEDULED" },
      })
      return {
        ok: true,
        toolName,
        resultSummary: "consulta remarcada",
        replies: [ai(`Pronto! Sua consulta foi remarcada para ${dateLabel(a.date, today)} às ${a.startTime}.`)],
        flow: { intent: "RESCHEDULE_APPOINTMENT", step: "COMPLETED" },
        audits: [
          {
            action: AuditAction.ASSIST_APPOINTMENT_RESCHEDULED,
            description: "Consulta remarcada pela Sinery Assist (IA).",
            metadata: { conversationId: ctx.conversationId, appointmentId: existing.id, patientId: ctx.patient!.id },
          },
        ],
        transferred: false,
      }
    }

    case "transferToHuman": {
      const a = args as { reason?: string }
      return transfer(
        toolName,
        ctx,
        ctx.aiSettings.humanFallbackMessage ?? "Vou chamar alguém da equipe para continuar o seu atendimento por aqui.",
        a.reason ?? "ai_requested"
      )
    }

    case "answerFromKnowledgeBase": {
      const a = args as { query?: string }
      const q = normalize(a.query ?? ctx.history[ctx.history.length - 1]?.content ?? "")
      const hit = q
        ? ctx.knowledge.find((k) => normalize(k.title).includes(q) || normalize(k.content).includes(q) || q.includes(normalize(k.title)))
        : undefined
      if (!hit) {
        return transfer(toolName, ctx, "Não encontrei essa informação por aqui. Vou chamar alguém da equipe para te ajudar.", "kb_no_match")
      }
      return {
        ok: true,
        toolName,
        resultSummary: `KB: ${hit.title}`,
        replies: [ai(`${hit.content} Posso ajudar com mais alguma coisa?`)],
        flow: null,
        audits: [],
        transferred: false,
      }
    }

    default:
      return fail(toolName, ctx, "unhandled_tool")
  }
}

function capabilityMessage(cap: "canSchedule" | "canReschedule" | "canCancel" | "canAnswerPricing"): string {
  switch (cap) {
    case "canAnswerPricing":
      return "Para valores, vou chamar alguém da equipe para te passar a informação correta."
    case "canSchedule":
      return "No momento não estou autorizada a agendar por aqui. Vou pedir para a equipe te ajudar."
    case "canReschedule":
      return "Para remarcar sua consulta, vou chamar alguém da equipe para te ajudar."
    case "canCancel":
      return "Para cancelar sua consulta, vou chamar alguém da equipe para te ajudar."
  }
}
