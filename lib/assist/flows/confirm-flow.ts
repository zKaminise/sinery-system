import "server-only"

import { prisma } from "@/lib/prisma"
import { AuditAction } from "@/lib/audit-actions"
import { clinicToday, utcToClinicParts } from "@/lib/appointments/date-utils"
import { aiReply, transferToHuman, type AssistContext } from "@/lib/assist/context"
import { optionDateLabel } from "@/lib/assist/appointment-helpers"
import type { AssistTurn } from "@/lib/assist/types"

/**
 * Confirms the patient's next pending appointment. If the earliest upcoming
 * appointment is already CONFIRMED, says so; if none is pending, transfers to
 * a human. Only SCHEDULED/RESCHEDULED move to CONFIRMED.
 */
export async function handleConfirm(ctx: AssistContext): Promise<AssistTurn> {
  if (!ctx.patient) {
    return transferToHuman(
      ctx,
      "Para confirmar sua consulta, vou chamar alguém da equipe para te ajudar.",
      "confirm_no_patient"
    )
  }

  const flowStarted = {
    action: AuditAction.ASSIST_CONFIRM_FLOW_STARTED,
    description: "Fluxo de confirmação iniciado pela Sinery Assist.",
    metadata: { conversationId: ctx.conversationId, patientId: ctx.patient.id },
  }

  // Earliest upcoming appointment that still occupies a slot.
  const next = await prisma.appointment.findFirst({
    where: {
      clinicId: ctx.clinicId,
      patientId: ctx.patient.id,
      status: { in: ["SCHEDULED", "RESCHEDULED", "CONFIRMED"] },
      startAt: { gte: new Date() },
    },
    orderBy: { startAt: "asc" },
    select: { id: true, status: true, startAt: true },
  })

  if (!next) {
    const transfer = transferToHuman(
      ctx,
      "Não encontrei uma consulta pendente de confirmação. Vou chamar alguém da equipe para verificar.",
      "confirm_no_appointment"
    )
    transfer.audits.unshift(flowStarted)
    return transfer
  }

  const parts = utcToClinicParts(next.startAt, ctx.timeZone)
  const label = optionDateLabel(parts.date, clinicToday(ctx.timeZone))

  if (next.status === "CONFIRMED") {
    return {
      replies: [aiReply(`Sua consulta de ${label} às ${parts.time} já está confirmada. Esperamos você!`)],
      flow: { intent: "CONFIRM_APPOINTMENT", step: "COMPLETED" },
      audits: [flowStarted],
    }
  }

  await prisma.appointment.update({ where: { id: next.id }, data: { status: "CONFIRMED" } })

  return {
    replies: [aiReply(`Consulta confirmada com sucesso para ${label} às ${parts.time}. Esperamos você!`)],
    flow: { intent: "CONFIRM_APPOINTMENT", step: "COMPLETED" },
    audits: [
      flowStarted,
      {
        action: AuditAction.ASSIST_APPOINTMENT_CONFIRMED,
        description: "Consulta confirmada pela Sinery Assist.",
        metadata: { conversationId: ctx.conversationId, appointmentId: next.id, patientId: ctx.patient.id },
      },
      {
        action: AuditAction.APPOINTMENT_CONFIRMED,
        description: "Consulta confirmada (via Sinery Assist).",
        metadata: { appointmentId: next.id, source: "AI" },
      },
      {
        action: AuditAction.ASSIST_FLOW_COMPLETED,
        description: "Fluxo de confirmação concluído pela Sinery Assist.",
        metadata: { conversationId: ctx.conversationId, flow: "CONFIRMING", appointmentId: next.id },
      },
    ],
  }
}
