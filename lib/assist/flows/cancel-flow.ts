import "server-only"

import { prisma } from "@/lib/prisma"
import { AuditAction } from "@/lib/audit-actions"
import { clinicToday } from "@/lib/appointments/date-utils"
import { isTerminalStatus } from "@/lib/appointments/availability"
import { aiReply, transferToHuman, type AssistContext } from "@/lib/assist/context"
import { parseSelection, parseYesNo } from "@/lib/assist/intent-detector"
import {
  getUpcomingActiveAppointments,
  optionDateLabel,
} from "@/lib/assist/appointment-helpers"
import type { AssistTurn, AssistFlowState, AssistAppointmentOption } from "@/lib/assist/types"

function describe(option: AssistAppointmentOption, timeZone: string): string {
  const label = optionDateLabel(option.date, clinicToday(timeZone))
  return `${option.serviceName ?? "consulta"} em ${label} às ${option.startTime}`
}

export async function startCancel(ctx: AssistContext): Promise<AssistTurn> {
  if (!ctx.aiSettings.canCancel) {
    return transferToHuman(
      ctx,
      "Para cancelar sua consulta, vou chamar alguém da equipe para te ajudar.",
      "cancel_disabled"
    )
  }
  if (!ctx.patient) {
    return transferToHuman(
      ctx,
      "Para cancelar, preciso confirmar seu cadastro. Vou chamar alguém da equipe para te ajudar.",
      "cancel_no_patient"
    )
  }

  const upcoming = await getUpcomingActiveAppointments(ctx.clinicId, ctx.patient.id, ctx.timeZone)

  if (upcoming.length === 0) {
    return transferToHuman(
      ctx,
      "Não encontrei consultas futuras em aberto para este paciente. Vou chamar alguém da equipe para verificar.",
      "cancel_no_appointments"
    )
  }

  const flowStarted = {
    action: AuditAction.ASSIST_CANCEL_FLOW_STARTED,
    description: "Fluxo de cancelamento iniciado pela Sinery Assist.",
    metadata: { conversationId: ctx.conversationId, patientId: ctx.patient.id, options: upcoming.length },
  }

  if (upcoming.length === 1) {
    const only = upcoming[0]
    return {
      replies: [
        aiReply(`Encontrei sua ${describe(only, ctx.timeZone)}. Deseja cancelar? Responda sim ou não.`),
      ],
      flow: {
        intent: "CANCEL_APPOINTMENT",
        step: "CONFIRM_CANCEL",
        selectedAppointmentId: only.appointmentId,
        appointmentOptions: upcoming,
      },
      audits: [flowStarted],
    }
  }

  const lines = upcoming.map((o) => `${o.index}. ${describe(o, ctx.timeZone)}`).join("\n")
  return {
    replies: [
      aiReply(`Você tem mais de uma consulta em aberto:\n${lines}\n\nQual delas deseja cancelar? Responda com o número.`),
    ],
    flow: {
      intent: "CANCEL_APPOINTMENT",
      step: "WAITING_APPOINTMENT_SELECTION",
      appointmentOptions: upcoming,
    },
    audits: [flowStarted],
  }
}

export async function continueCancel(ctx: AssistContext, flow: AssistFlowState): Promise<AssistTurn> {
  const options = flow.appointmentOptions ?? []

  if (flow.step === "WAITING_APPOINTMENT_SELECTION") {
    const selection = parseSelection(ctx.text)
    const chosen = selection ? options.find((o) => o.index === selection) : undefined
    if (!chosen) {
      return {
        replies: [aiReply("Não identifiquei a opção. Responda com o número da consulta que deseja cancelar.")],
        flow,
        audits: [],
      }
    }
    return {
      replies: [aiReply(`Deseja cancelar a ${describe(chosen, ctx.timeZone)}? Responda sim ou não.`)],
      flow: { ...flow, step: "CONFIRM_CANCEL", selectedAppointmentId: chosen.appointmentId },
      audits: [
        {
          action: AuditAction.ASSIST_APPOINTMENT_SELECTED_FOR_CANCEL,
          description: "Consulta selecionada para cancelamento.",
          metadata: { conversationId: ctx.conversationId, appointmentId: chosen.appointmentId },
        },
      ],
    }
  }

  if (flow.step === "CONFIRM_CANCEL") {
    const answer = parseYesNo(ctx.text)
    if (answer === null) {
      return { replies: [aiReply("Só para confirmar: deseja cancelar? Responda sim ou não.")], flow, audits: [] }
    }
    if (answer === "no") {
      return {
        replies: [aiReply("Tudo bem, não cancelei sua consulta. Quer que eu chame alguém da equipe?")],
        flow: { intent: "CANCEL_APPOINTMENT", step: "COMPLETED" },
        audits: [
          {
            action: AuditAction.ASSIST_FLOW_CANCELLED_BY_PATIENT,
            description: "Paciente optou por não cancelar a consulta.",
            metadata: { conversationId: ctx.conversationId, flow: "CANCELLING" },
          },
        ],
      }
    }

    // Confirmed cancel — re-check the appointment is still cancellable.
    const appointmentId = flow.selectedAppointmentId
    const chosen = options.find((o) => o.appointmentId === appointmentId)
    const existing = appointmentId
      ? await prisma.appointment.findFirst({
          where: { id: appointmentId, clinicId: ctx.clinicId },
          select: { id: true, status: true },
        })
      : null

    if (!existing || isTerminalStatus(existing.status)) {
      return transferToHuman(
        ctx,
        "Essa consulta não pode mais ser cancelada por aqui. Vou chamar alguém da equipe.",
        "cancel_not_cancellable"
      )
    }

    await prisma.appointment.update({
      where: { id: existing.id },
      data: { status: "CANCELLED" },
    })

    return {
      replies: [
        aiReply(
          chosen
            ? `Pronto! Sua ${describe(chosen, ctx.timeZone)} foi cancelada. Posso ajudar com mais alguma coisa?`
            : "Pronto! Sua consulta foi cancelada. Posso ajudar com mais alguma coisa?"
        ),
      ],
      flow: { intent: "CANCEL_APPOINTMENT", step: "COMPLETED" },
      audits: [
        {
          action: AuditAction.ASSIST_APPOINTMENT_CANCELLED,
          description: "Consulta cancelada pela Sinery Assist.",
          metadata: { conversationId: ctx.conversationId, appointmentId: existing.id, patientId: ctx.patient?.id },
        },
        {
          action: AuditAction.APPOINTMENT_CANCELLED,
          description: "Consulta cancelada (via Sinery Assist).",
          metadata: { appointmentId: existing.id, source: "AI" },
        },
        {
          action: AuditAction.ASSIST_FLOW_COMPLETED,
          description: "Fluxo de cancelamento concluído pela Sinery Assist.",
          metadata: { conversationId: ctx.conversationId, flow: "CANCELLING", appointmentId: existing.id },
        },
      ],
    }
  }

  return startCancel(ctx)
}
