import "server-only"

import { prisma } from "@/lib/prisma"
import { AuditAction } from "@/lib/audit-actions"
import { validateAndResolveAppointment } from "@/lib/appointments/validate-appointment"
import { clinicToday } from "@/lib/appointments/date-utils"
import { findAvailableSlots, type SlotsEmptyReason } from "@/lib/assist/available-slots"
import { parseSelection } from "@/lib/assist/intent-detector"
import { parsePatientDateExpression, type AssistPeriod } from "@/lib/assist/date-parser"
import { matchServiceFromMessage } from "@/lib/assist/service-matcher"
import { aiReply, type AssistContext } from "@/lib/assist/context"
import type { AssistTurn, AssistSlot, AssistFlowState } from "@/lib/assist/types"

/** Friendly date label: "hoje" / "amanhã" / "dd/MM". */
function dateLabel(dateStr: string, timeZone: string): string {
  const today = clinicToday(timeZone)
  const [, m, d] = dateStr.split("-").map(Number)
  const [ty, tm, td] = today.split("-").map(Number)
  const dt = new Date(Date.UTC(ty, tm - 1, td) + 86_400_000)
  const tomorrow = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`
  if (dateStr === today) return "hoje"
  if (dateStr === tomorrow) return "amanhã"
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`
}

const PERIOD_LABEL: Record<AssistPeriod, string> = {
  MORNING: " de manhã",
  AFTERNOON: " à tarde",
  EVENING: " à noite",
  ANY: "",
}

const NEEDS_PATIENT =
  "Para agendar, preciso que esta conversa esteja vinculada a um paciente cadastrado. Você pode iniciar uma simulação escolhendo um paciente."

/** Human message for an empty-slots reason. */
function emptyReasonMessage(reason: SlotsEmptyReason, serviceName: string, dateLbl: string): string {
  switch (reason) {
    case "NO_PROFESSIONAL_LINKED":
      return `Ainda não temos um profissional disponível para ${serviceName}. Vou pedir para a equipe te ajudar.`
    case "NO_WORKING_HOURS":
      return `Não há atendimento para ${serviceName} nesse dia. Quer tentar outra data?`
    case "SERVICE_INACTIVE":
      return `Esse serviço não está disponível no momento. Quer escolher outro?`
    case "INVALID_DATE":
      return "Não entendi a data. Você pode dizer, por exemplo, \"amanhã\" ou \"12/07\"?"
    case "FULLY_BOOKED":
    default:
      return `Não encontrei horários disponíveis para ${serviceName} em ${dateLbl}. Quer tentar outro dia?`
  }
}

/** Builds a turn presenting up to 3 slots or asking for another day. */
async function presentSlots(
  ctx: AssistContext,
  serviceId: string,
  serviceName: string,
  date: string,
  period: AssistPeriod | null,
  intent: AssistFlowState["intent"]
): Promise<AssistTurn> {
  const result = await findAvailableSlots({
    clinicId: ctx.clinicId,
    serviceId,
    date,
    limit: 3,
    period,
  })

  const dateLbl = dateLabel(date, ctx.timeZone) + (period ? PERIOD_LABEL[period] : "")

  if (result.slots.length === 0) {
    const reason = result.reasonIfEmpty ?? "FULLY_BOOKED"
    const backStep = intent === "RESCHEDULE_APPOINTMENT" ? "WAITING_NEW_DATE" : "WAITING_DATE"
    return {
      replies: [aiReply(emptyReasonMessage(reason, serviceName, dateLbl))],
      flow: {
        intent,
        step: backStep,
        detectedServiceId: serviceId,
        detectedServiceName: serviceName,
        detectedPeriod: period ?? undefined,
        selectedAppointmentId: ctx.flow?.selectedAppointmentId,
      },
      audits: [],
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
    replies: [
      aiReply(
        `Encontrei estes horários para ${serviceName} em ${dateLbl}:\n${lines}\n\nResponda com o número da opção desejada.`
      ),
    ],
    flow: {
      intent,
      step: "WAITING_SLOT_SELECTION",
      detectedServiceId: serviceId,
      detectedServiceName: serviceName,
      detectedDate: date,
      detectedPeriod: period ?? undefined,
      suggestedSlots: slots,
      selectedAppointmentId: ctx.flow?.selectedAppointmentId,
    },
    audits: [
      {
        action: AuditAction.ASSIST_SLOTS_SUGGESTED,
        description: `${slots.length} horário(s) sugerido(s) para ${serviceName}.`,
        metadata: { conversationId: ctx.conversationId, serviceId, date, count: slots.length },
      },
    ],
  }
}

/** Entry point for a fresh SCHEDULE_APPOINTMENT intent. */
export async function startSchedule(ctx: AssistContext): Promise<AssistTurn> {
  if (!ctx.aiSettings.canSchedule) {
    return {
      replies: [
        aiReply("No momento não estou autorizada a agendar por aqui. Vou pedir para a equipe te ajudar."),
        { senderType: "SYSTEM", content: "Agendamento pela Assist está desativado nas configurações." },
      ],
      flow: { intent: "SCHEDULE_APPOINTMENT", step: "TRANSFERRED_TO_HUMAN" },
      status: "WAITING_HUMAN",
      audits: [
        {
          action: AuditAction.ASSIST_TRANSFERRED_TO_HUMAN,
          description: "Agendamento pela Assist desativado — transferida para humano.",
          metadata: { conversationId: ctx.conversationId, reason: "scheduling_disabled" },
        },
      ],
    }
  }

  if (!ctx.patient) {
    return { replies: [aiReply(NEEDS_PATIENT)], flow: null, audits: [] }
  }

  const started = {
    action: AuditAction.ASSIST_SCHEDULE_FLOW_STARTED,
    description: "Fluxo de agendamento iniciado pela Sinery Assist.",
    metadata: { conversationId: ctx.conversationId, patientId: ctx.patient.id },
  }

  const match = matchServiceFromMessage(ctx.text, ctx.services)
  const parsedDate = parsePatientDateExpression(ctx.text, ctx.timeZone)
  const date = parsedDate.date
  const period = parsedDate.period

  if (match.status === "ambiguous") {
    const names = match.candidates.map((c) => c.name).join(" ou ")
    return {
      replies: [aiReply(`Encontrei mais de uma opção. Você quer agendar ${names}?`)],
      flow: { intent: "SCHEDULE_APPOINTMENT", step: "WAITING_SERVICE", detectedDate: date ?? undefined, detectedPeriod: period ?? undefined },
      audits: [started],
    }
  }
  if (match.status === "none") {
    const names = ctx.services.slice(0, 5).map((s) => s.name).join(", ")
    return {
      replies: [aiReply(`Claro! Qual serviço você gostaria de agendar? Temos: ${names}.`)],
      flow: { intent: "SCHEDULE_APPOINTMENT", step: "WAITING_SERVICE", detectedDate: date ?? undefined, detectedPeriod: period ?? undefined },
      audits: [started],
    }
  }

  const service = match.service
  if (!date) {
    return {
      replies: [aiReply(`Perfeito, ${service.name}. Para qual dia você gostaria de verificar horários?`)],
      flow: {
        intent: "SCHEDULE_APPOINTMENT",
        step: "WAITING_DATE",
        detectedServiceId: service.id,
        detectedServiceName: service.name,
        detectedPeriod: period ?? undefined,
      },
      audits: [started],
    }
  }

  const turn = await presentSlots(ctx, service.id, service.name, date, period, "SCHEDULE_APPOINTMENT")
  turn.audits.unshift(started)
  return turn
}

/** Continuation for an in-progress schedule flow. */
export async function continueSchedule(ctx: AssistContext, flow: AssistFlowState): Promise<AssistTurn> {
  if (!ctx.patient) {
    return { replies: [aiReply(NEEDS_PATIENT)], flow: null, audits: [] }
  }

  if (flow.step === "WAITING_SERVICE") {
    const match = matchServiceFromMessage(ctx.text, ctx.services)
    if (match.status === "ambiguous") {
      const names = match.candidates.map((c) => c.name).join(" ou ")
      return { replies: [aiReply(`Só para confirmar: você quer ${names}?`)], flow, audits: [] }
    }
    if (match.status === "none") {
      const names = ctx.services.slice(0, 5).map((s) => s.name).join(", ")
      return { replies: [aiReply(`Não identifiquei o serviço. Você pode escolher entre: ${names}.`)], flow, audits: [] }
    }
    const service = match.service
    if (flow.detectedDate) {
      return presentSlots(ctx, service.id, service.name, flow.detectedDate, flow.detectedPeriod ?? null, "SCHEDULE_APPOINTMENT")
    }
    return {
      replies: [aiReply(`Perfeito, ${service.name}. Para qual dia você gostaria de verificar horários?`)],
      flow: { intent: "SCHEDULE_APPOINTMENT", step: "WAITING_DATE", detectedServiceId: service.id, detectedServiceName: service.name, detectedPeriod: flow.detectedPeriod },
      audits: [],
    }
  }

  if (flow.step === "WAITING_DATE") {
    const parsed = parsePatientDateExpression(ctx.text, ctx.timeZone)
    if (!parsed.date) {
      return {
        replies: [aiReply("Não entendi a data. Você pode dizer, por exemplo, \"amanhã\", \"sexta\" ou \"12/07\".")],
        flow,
        audits: [],
      }
    }
    if (!flow.detectedServiceId || !flow.detectedServiceName) {
      const names = ctx.services.slice(0, 5).map((s) => s.name).join(", ")
      return {
        replies: [aiReply(`Qual serviço você gostaria de agendar? Temos: ${names}.`)],
        flow: { intent: "SCHEDULE_APPOINTMENT", step: "WAITING_SERVICE", detectedDate: parsed.date, detectedPeriod: parsed.period ?? undefined },
        audits: [],
      }
    }
    return presentSlots(ctx, flow.detectedServiceId, flow.detectedServiceName, parsed.date, parsed.period ?? flow.detectedPeriod ?? null, "SCHEDULE_APPOINTMENT")
  }

  if (flow.step === "WAITING_SLOT_SELECTION") {
    const selection = parseSelection(ctx.text)
    const slots = flow.suggestedSlots ?? []
    const chosen = selection ? slots.find((s) => s.index === selection) : undefined
    if (!chosen) {
      return {
        replies: [aiReply("Não identifiquei a opção. Responda com o número do horário desejado (1, 2 ou 3).")],
        flow,
        audits: [],
      }
    }
    return createAppointment(ctx, chosen)
  }

  return startSchedule(ctx)
}

/** Creates the appointment for the chosen slot, re-validating against agenda rules. */
async function createAppointment(ctx: AssistContext, slot: AssistSlot): Promise<AssistTurn> {
  const patient = ctx.patient!

  const validation = await validateAndResolveAppointment({
    clinicId: ctx.clinicId,
    patientId: patient.id,
    professionalId: slot.professionalId,
    serviceId: slot.serviceId,
    date: slot.date,
    startTime: slot.startTime,
    endTime: slot.endTime,
  })

  if (!validation.ok) {
    // The slot was taken (or a rule changed) between suggestion and choice.
    const turn = await presentSlots(ctx, slot.serviceId, slot.serviceName, slot.date, ctx.flow?.detectedPeriod ?? null, "SCHEDULE_APPOINTMENT")
    return {
      ...turn,
      replies: [aiReply("Esse horário acabou de ficar indisponível. Vou buscar novas opções para você:"), ...turn.replies],
    }
  }

  const appointment = await prisma.appointment.create({
    data: {
      clinicId: ctx.clinicId,
      patientId: patient.id,
      professionalId: slot.professionalId,
      serviceId: validation.serviceId,
      title: validation.title,
      startAt: validation.startAt,
      endAt: validation.endAt,
      status: "SCHEDULED",
      notes: null,
      createdByUserId: null,
      createdBySource: "AI",
    },
    select: { id: true },
  })

  return {
    replies: [
      aiReply(
        `Perfeito! Sua consulta de ${slot.serviceName} foi agendada para ${dateLabel(slot.date, ctx.timeZone)} às ${slot.startTime} com ${slot.professionalName}.`
      ),
    ],
    flow: { intent: "SCHEDULE_APPOINTMENT", step: "COMPLETED" },
    audits: [
      {
        action: AuditAction.ASSIST_SLOT_SELECTED,
        description: `Horário ${slot.startTime} selecionado para ${slot.serviceName}.`,
        metadata: { conversationId: ctx.conversationId, selectedSlot: `${slot.date} ${slot.startTime}`, professionalId: slot.professionalId },
      },
      {
        action: AuditAction.ASSIST_APPOINTMENT_CREATED,
        description: `Consulta de ${slot.serviceName} criada pela Sinery Assist para ${patient.name}.`,
        metadata: {
          conversationId: ctx.conversationId,
          appointmentId: appointment.id,
          patientId: patient.id,
          serviceId: slot.serviceId,
          professionalId: slot.professionalId,
          selectedSlot: `${slot.date} ${slot.startTime}`,
        },
      },
      {
        action: AuditAction.APPOINTMENT_CREATED,
        description: `Consulta de ${patient.name} foi criada (via Sinery Assist).`,
        metadata: { appointmentId: appointment.id, patientId: patient.id, serviceId: slot.serviceId, professionalId: slot.professionalId, source: "AI" },
      },
      {
        action: AuditAction.ASSIST_FLOW_COMPLETED,
        description: "Fluxo de agendamento concluído pela Sinery Assist.",
        metadata: { conversationId: ctx.conversationId, flow: "SCHEDULING", appointmentId: appointment.id },
      },
    ],
  }
}
