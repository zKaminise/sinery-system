import "server-only"

import { prisma } from "@/lib/prisma"
import { AuditAction } from "@/lib/audit-actions"
import { clinicToday } from "@/lib/appointments/date-utils"
import { isTerminalStatus } from "@/lib/appointments/availability"
import { validateAndResolveAppointment } from "@/lib/appointments/validate-appointment"
import { aiReply, transferToHuman, type AssistContext } from "@/lib/assist/context"
import { parseSelection } from "@/lib/assist/intent-detector"
import { parsePatientDateExpression } from "@/lib/assist/date-parser"
import { findAvailableSlots } from "@/lib/assist/available-slots"
import { getUpcomingActiveAppointments, optionDateLabel } from "@/lib/assist/appointment-helpers"
import type { AssistTurn, AssistFlowState, AssistSlot, AssistAppointmentOption } from "@/lib/assist/types"

function describe(o: AssistAppointmentOption, timeZone: string): string {
  return `${o.serviceName ?? "consulta"} em ${optionDateLabel(o.date, clinicToday(timeZone))} às ${o.startTime}`
}

async function askNewDate(
  ctx: AssistContext,
  option: AssistAppointmentOption
): Promise<AssistTurn> {
  return {
    replies: [
      aiReply(`Vamos remarcar sua ${describe(option, ctx.timeZone)}. Para qual novo dia você gostaria?`),
    ],
    flow: {
      intent: "RESCHEDULE_APPOINTMENT",
      step: "WAITING_NEW_DATE",
      selectedAppointmentId: option.appointmentId,
      detectedServiceId: option.serviceId ?? undefined,
      detectedServiceName: option.serviceName ?? undefined,
    },
    audits: [
      {
        action: AuditAction.ASSIST_APPOINTMENT_SELECTED_FOR_RESCHEDULE,
        description: `Consulta selecionada para remarcação.`,
        metadata: { conversationId: ctx.conversationId, appointmentId: option.appointmentId },
      },
    ],
  }
}

export async function startReschedule(ctx: AssistContext): Promise<AssistTurn> {
  if (!ctx.aiSettings.canReschedule) {
    return transferToHuman(
      ctx,
      "Para remarcar sua consulta, vou chamar alguém da equipe para te ajudar.",
      "reschedule_disabled"
    )
  }
  if (!ctx.patient) {
    return transferToHuman(
      ctx,
      "Para remarcar, preciso confirmar seu cadastro. Vou chamar alguém da equipe para te ajudar.",
      "reschedule_no_patient"
    )
  }

  const upcoming = await getUpcomingActiveAppointments(ctx.clinicId, ctx.patient.id, ctx.timeZone)

  if (upcoming.length === 0) {
    return transferToHuman(
      ctx,
      "Não encontrei consultas futuras em aberto para remarcar. Vou chamar alguém da equipe.",
      "reschedule_no_appointments"
    )
  }

  if (upcoming.length === 1) {
    const only = upcoming[0]
    if (!only.serviceId) {
      return transferToHuman(
        ctx,
        "Sua consulta não tem um serviço definido, então vou chamar alguém da equipe para remarcar.",
        "reschedule_no_service"
      )
    }
    const turn = await askNewDate(ctx, only)
    turn.audits.unshift({
      action: AuditAction.ASSIST_RESCHEDULE_FLOW_STARTED,
      description: "Fluxo de remarcação iniciado pela Sinery Assist.",
      metadata: { conversationId: ctx.conversationId, patientId: ctx.patient.id, options: 1 },
    })
    return turn
  }

  const lines = upcoming.map((o) => `${o.index}. ${describe(o, ctx.timeZone)}`).join("\n")
  return {
    replies: [
      aiReply(`Você tem mais de uma consulta em aberto:\n${lines}\n\nQual delas deseja remarcar? Responda com o número.`),
    ],
    flow: {
      intent: "RESCHEDULE_APPOINTMENT",
      step: "WAITING_APPOINTMENT_SELECTION",
      appointmentOptions: upcoming,
    },
    audits: [
      {
        action: AuditAction.ASSIST_RESCHEDULE_FLOW_STARTED,
        description: "Fluxo de remarcação iniciado pela Sinery Assist.",
        metadata: { conversationId: ctx.conversationId, patientId: ctx.patient.id, options: upcoming.length },
      },
    ],
  }
}

export async function continueReschedule(ctx: AssistContext, flow: AssistFlowState): Promise<AssistTurn> {
  if (flow.step === "WAITING_APPOINTMENT_SELECTION") {
    const options = flow.appointmentOptions ?? []
    const selection = parseSelection(ctx.text)
    const chosen = selection ? options.find((o) => o.index === selection) : undefined
    if (!chosen) {
      return {
        replies: [aiReply("Não identifiquei a opção. Responda com o número da consulta que deseja remarcar.")],
        flow,
        audits: [],
      }
    }
    if (!chosen.serviceId) {
      return transferToHuman(
        ctx,
        "Essa consulta não tem um serviço definido, então vou chamar alguém da equipe.",
        "reschedule_no_service"
      )
    }
    return askNewDate(ctx, chosen)
  }

  if (flow.step === "WAITING_NEW_DATE") {
    const parsed = parsePatientDateExpression(ctx.text, ctx.timeZone)
    if (!parsed.date) {
      return {
        replies: [aiReply("Não entendi a data. Você pode dizer, por exemplo, \"amanhã\", \"sexta\" ou \"15/07\".")],
        flow,
        audits: [],
      }
    }
    if (!flow.detectedServiceId) {
      return transferToHuman(ctx, "Vou chamar alguém da equipe para concluir a remarcação.", "reschedule_missing_service")
    }
    const result = await findAvailableSlots({
      clinicId: ctx.clinicId,
      serviceId: flow.detectedServiceId,
      date: parsed.date,
      limit: 3,
      period: parsed.period,
    })
    if (result.slots.length === 0) {
      return {
        replies: [aiReply(`Não encontrei horários para ${flow.detectedServiceName ?? "o serviço"} nesse dia. Quer tentar outro dia?`)],
        flow,
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
        aiReply(`Encontrei estes novos horários:\n${lines}\n\nResponda com o número da opção desejada.`),
      ],
      flow: { ...flow, step: "WAITING_SLOT_SELECTION", detectedDate: parsed.date, suggestedSlots: slots },
      audits: [
        {
          action: AuditAction.ASSIST_SLOTS_SUGGESTED,
          description: `${slots.length} novo(s) horário(s) sugerido(s) para remarcação.`,
          metadata: { conversationId: ctx.conversationId, count: slots.length, date: parsed.date },
        },
      ],
    }
  }

  if (flow.step === "WAITING_SLOT_SELECTION") {
    const slots = flow.suggestedSlots ?? []
    const selection = parseSelection(ctx.text)
    const chosen = selection ? slots.find((s) => s.index === selection) : undefined
    if (!chosen) {
      return {
        replies: [aiReply("Não identifiquei a opção. Responda com o número do novo horário (1, 2 ou 3).")],
        flow,
        audits: [],
      }
    }
    return applyReschedule(ctx, flow, chosen)
  }

  return startReschedule(ctx)
}

async function applyReschedule(
  ctx: AssistContext,
  flow: AssistFlowState,
  slot: AssistSlot
): Promise<AssistTurn> {
  const appointmentId = flow.selectedAppointmentId
  const existing = appointmentId
    ? await prisma.appointment.findFirst({
        where: { id: appointmentId, clinicId: ctx.clinicId },
        select: { id: true, status: true },
      })
    : null

  if (!existing || isTerminalStatus(existing.status)) {
    return transferToHuman(
      ctx,
      "Essa consulta não pode mais ser remarcada por aqui. Vou chamar alguém da equipe.",
      "reschedule_not_editable"
    )
  }

  const validation = await validateAndResolveAppointment({
    clinicId: ctx.clinicId,
    patientId: ctx.patient!.id,
    professionalId: slot.professionalId,
    serviceId: slot.serviceId,
    date: slot.date,
    startTime: slot.startTime,
    endTime: slot.endTime,
    excludeAppointmentId: existing.id,
  })

  if (!validation.ok) {
    return transferToHuman(
      ctx,
      "Esse horário não está mais disponível. Vou chamar alguém da equipe para concluir a remarcação.",
      "reschedule_slot_taken"
    )
  }

  await prisma.appointment.update({
    where: { id: existing.id },
    data: {
      professionalId: slot.professionalId,
      serviceId: validation.serviceId,
      startAt: validation.startAt,
      endAt: validation.endAt,
      status: "RESCHEDULED",
    },
  })

  return {
    replies: [
      aiReply(
        `Pronto! Sua consulta de ${slot.serviceName} foi remarcada para ${optionDateLabel(slot.date, clinicToday(ctx.timeZone))} às ${slot.startTime} com ${slot.professionalName}.`
      ),
    ],
    flow: { intent: "RESCHEDULE_APPOINTMENT", step: "COMPLETED" },
    audits: [
      {
        action: AuditAction.ASSIST_SLOT_SELECTED,
        description: `Novo horário ${slot.startTime} selecionado para remarcação.`,
        metadata: { conversationId: ctx.conversationId, selectedSlot: `${slot.date} ${slot.startTime}` },
      },
      {
        action: AuditAction.ASSIST_APPOINTMENT_RESCHEDULED,
        description: "Consulta remarcada pela Sinery Assist.",
        metadata: {
          conversationId: ctx.conversationId,
          appointmentId: existing.id,
          patientId: ctx.patient!.id,
          selectedSlot: `${slot.date} ${slot.startTime}`,
        },
      },
      {
        action: AuditAction.APPOINTMENT_RESCHEDULED,
        description: "Consulta remarcada (via Sinery Assist).",
        metadata: { appointmentId: existing.id, source: "AI" },
      },
      {
        action: AuditAction.ASSIST_FLOW_COMPLETED,
        description: "Fluxo de remarcação concluído pela Sinery Assist.",
        metadata: { conversationId: ctx.conversationId, flow: "RESCHEDULING", appointmentId: existing.id },
      },
    ],
  }
}
