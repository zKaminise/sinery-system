import { prisma } from "@/lib/prisma"
import { requireApiUser } from "@/lib/api-auth"
import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"
import { successResponse, errorResponse } from "@/lib/api-response"
import { appointmentFormSchema } from "@/lib/validators/appointment"
import { canManageAppointments } from "@/lib/permissions"
import { validateAndResolveAppointment } from "@/lib/appointments/validate-appointment"

export async function POST(request: Request) {
  const auth = await requireApiUser()
  if (!auth.ok) {
    return errorResponse(auth.message, auth.status)
  }

  if (!canManageAppointments(auth.user.role)) {
    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.APPOINTMENT_ACCESS_DENIED,
      entity: "Appointment",
      description: "Tentativa não permitida de criar consulta.",
    })
    return errorResponse("Você não tem permissão para criar consultas.", 403)
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
  })
  if (!validation.ok) {
    return errorResponse(validation.message, validation.status)
  }

  try {
    const appointment = await prisma.appointment.create({
      data: {
        clinicId: auth.user.clinicId,
        patientId,
        professionalId,
        serviceId: validation.serviceId,
        title: validation.title,
        startAt: validation.startAt,
        endAt: validation.endAt,
        status: "SCHEDULED",
        notes: notes ?? null,
        createdByUserId: auth.user.id,
        createdBySource: "USER",
      },
      select: {
        id: true,
        patient: { select: { name: true } },
        professional: { select: { name: true } },
      },
    })

    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.APPOINTMENT_CREATED,
      entity: "Appointment",
      entityId: appointment.id,
      description: `Consulta de ${appointment.patient.name} com ${appointment.professional.name} foi criada.`,
      metadata: { patientId, professionalId, serviceId: validation.serviceId },
    })

    return successResponse({ id: appointment.id }, 201)
  } catch (error) {
    return errorResponse("Não foi possível criar a consulta.", 500, {
      code: "INTERNAL_ERROR",
      logContext: "appointments.create",
      logError: error,
      logMetadata: { clinicId: auth.user.clinicId },
    })
  }
}
