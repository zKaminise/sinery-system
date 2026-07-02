import { prisma } from "@/lib/prisma"
import { requireApiUser } from "@/lib/api-auth"
import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"
import { successResponse, errorResponse } from "@/lib/api-response"
import { appointmentFormSchema } from "@/lib/validators/appointment"
import { canManageAppointments } from "@/lib/permissions"
import { isTerminalStatus } from "@/lib/appointments/availability"
import { validateAndResolveAppointment } from "@/lib/appointments/validate-appointment"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ appointmentId: string }> }
) {
  const auth = await requireApiUser()
  if (!auth.ok) {
    return errorResponse(auth.message, auth.status)
  }

  const { appointmentId } = await params

  // Tenant guard: appointment must belong to the user's clinic.
  const existing = await prisma.appointment.findFirst({
    where: { id: appointmentId, clinicId: auth.user.clinicId },
    select: {
      id: true,
      status: true,
      startAt: true,
      endAt: true,
      professionalId: true,
      patient: { select: { name: true } },
    },
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
      description: "Tentativa não permitida de editar consulta.",
    })
    return errorResponse("Você não tem permissão para editar consultas.", 403)
  }

  // Terminal appointments are locked for editing — only their existence
  // remains, for history.
  if (isTerminalStatus(existing.status)) {
    return errorResponse(
      "Não é possível editar uma consulta concluída, cancelada ou marcada como falta.",
      422
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse("Requisição inválida.", 400)
  }

  const parsed = appointmentFormSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "Dados inválidos.", 422)
  }

  const { patientId, professionalId, serviceId, date, startTime, endTime, notes } = parsed.data

  const validation = await validateAndResolveAppointment({
    clinicId: auth.user.clinicId,
    patientId,
    professionalId,
    serviceId,
    date,
    startTime,
    endTime,
    excludeAppointmentId: existing.id,
  })
  if (!validation.ok) {
    return errorResponse(validation.message, validation.status)
  }

  // A change to date/time/professional counts as a reschedule.
  const isReschedule =
    existing.startAt.getTime() !== validation.startAt.getTime() ||
    existing.endAt.getTime() !== validation.endAt.getTime() ||
    existing.professionalId !== professionalId

  try {
    const updated = await prisma.appointment.update({
      where: { id: existing.id },
      data: {
        patientId,
        professionalId,
        serviceId: validation.serviceId,
        title: validation.title,
        startAt: validation.startAt,
        endAt: validation.endAt,
        notes: notes ?? null,
        // On reschedule, move to RESCHEDULED so the change is visible in the
        // agenda; otherwise keep the current status untouched.
        ...(isReschedule ? { status: "RESCHEDULED" as const } : {}),
      },
      select: { id: true, patient: { select: { name: true } } },
    })

    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.APPOINTMENT_UPDATED,
      entity: "Appointment",
      entityId: updated.id,
      description: `Consulta de ${updated.patient.name} foi atualizada.`,
    })

    if (isReschedule) {
      await createAuditLog({
        clinicId: auth.user.clinicId,
        userId: auth.user.id,
        action: AuditAction.APPOINTMENT_RESCHEDULED,
        entity: "Appointment",
        entityId: updated.id,
        description: `Consulta de ${updated.patient.name} foi remarcada.`,
        metadata: {
          oldStartAt: existing.startAt.toISOString(),
          newStartAt: validation.startAt.toISOString(),
          oldProfessionalId: existing.professionalId,
          newProfessionalId: professionalId,
        },
      })
    }

    return successResponse({ id: updated.id })
  } catch (error) {
    return errorResponse("Não foi possível atualizar a consulta.", 500, {
      code: "INTERNAL_ERROR",
      logContext: "appointments.update",
      logError: error,
      logMetadata: { clinicId: auth.user.clinicId, appointmentId: existing.id },
    })
  }
}
