import { prisma } from "@/lib/prisma"
import { requireApiUser } from "@/lib/api-auth"
import { createAuditLog } from "@/lib/audit"
import { AuditAction, type AuditActionValue } from "@/lib/audit-actions"
import { successResponse, errorResponse } from "@/lib/api-response"
import { updateAppointmentStatusSchema } from "@/lib/validators/appointment"
import { canManageAppointments } from "@/lib/permissions"
import { canTransitionStatus } from "@/lib/appointments/availability"
import type { AppointmentStatus } from "@/lib/generated/prisma/client"

const ACTION_BY_STATUS: Record<string, { action: AuditActionValue; verb: string }> = {
  CONFIRMED: { action: AuditAction.APPOINTMENT_CONFIRMED, verb: "confirmada" },
  CANCELLED: { action: AuditAction.APPOINTMENT_CANCELLED, verb: "cancelada" },
  COMPLETED: { action: AuditAction.APPOINTMENT_COMPLETED, verb: "concluída" },
  NO_SHOW: { action: AuditAction.APPOINTMENT_NO_SHOW, verb: "marcada como falta" },
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ appointmentId: string }> }
) {
  const auth = await requireApiUser()
  if (!auth.ok) {
    return errorResponse(auth.message, auth.status)
  }

  const { appointmentId } = await params

  const existing = await prisma.appointment.findFirst({
    where: { id: appointmentId, clinicId: auth.user.clinicId },
    select: { id: true, status: true, notes: true, patient: { select: { name: true } } },
  })
  if (!existing) {
    return errorResponse("Consulta não encontrada.", 404)
  }

  if (!canManageAppointments(auth.user.role)) {
    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.APPOINTMENT_ACCESS_DENIED,
      entity: "Appointment",
      entityId: existing.id,
      description: "Tentativa não permitida de alterar status de consulta.",
    })
    return errorResponse("Você não tem permissão para alterar consultas.", 403)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse("Requisição inválida.", 400)
  }

  const parsed = updateAppointmentStatusSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "Dados inválidos.", 422)
  }

  const targetStatus = parsed.data.status as AppointmentStatus

  // Enforce the V1 state machine (terminal statuses are locked; only
  // confirm/cancel/complete/no-show are reachable).
  if (!canTransitionStatus(existing.status, targetStatus)) {
    return errorResponse(
      "Esta mudança de status não é permitida para a consulta.",
      422
    )
  }

  const meta = ACTION_BY_STATUS[targetStatus]
  if (!meta) {
    return errorResponse("Status inválido.", 422)
  }

  // Optional note (e.g. cancellation reason) is appended, preserving history.
  const newNotes = parsed.data.notes
    ? existing.notes
      ? `${existing.notes}\n${parsed.data.notes}`
      : parsed.data.notes
    : existing.notes

  try {
    const updated = await prisma.appointment.update({
      where: { id: existing.id },
      data: { status: targetStatus, notes: newNotes },
      select: { id: true, patient: { select: { name: true } } },
    })

    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: meta.action,
      entity: "Appointment",
      entityId: updated.id,
      description: `Consulta de ${updated.patient.name} foi ${meta.verb}.`,
      metadata: { oldStatus: existing.status, newStatus: targetStatus },
    })

    return successResponse({ id: updated.id })
  } catch (error) {
    return errorResponse("Não foi possível alterar o status da consulta.", 500, {
      code: "INTERNAL_ERROR",
      logContext: "appointments.status",
      logError: error,
      logMetadata: { clinicId: auth.user.clinicId, appointmentId: existing.id },
    })
  }
}
