import { prisma } from "@/lib/prisma"
import { requireApiUser } from "@/lib/api-auth"
import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"
import { successResponse, errorResponse } from "@/lib/api-response"
import { workingHourFormSchema, findOverlappingWorkingHour } from "@/lib/validators/working-hour"
import { canManageWorkingHours } from "@/lib/permissions"

async function loadScoped(clinicId: string, professionalId: string, workingHourId: string) {
  const professional = await prisma.professional.findFirst({
    where: { id: professionalId, clinicId },
    select: { id: true, name: true },
  })
  if (!professional) return { professional: null, workingHour: null }

  const workingHour = await prisma.workingHour.findFirst({
    where: { id: workingHourId, clinicId, professionalId },
    select: { id: true, dayOfWeek: true, startTime: true, endTime: true, active: true },
  })
  return { professional, workingHour }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ professionalId: string; workingHourId: string }> }
) {
  const auth = await requireApiUser()
  if (!auth.ok) {
    return errorResponse(auth.message, auth.status)
  }

  const { professionalId, workingHourId } = await params
  const { professional, workingHour } = await loadScoped(auth.user.clinicId, professionalId, workingHourId)

  if (!professional || !workingHour) {
    return errorResponse("Horário de atendimento não encontrado.", 404)
  }

  if (!canManageWorkingHours(auth.user.role)) {
    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.PROFESSIONAL_ACCESS_DENIED,
      entity: "WorkingHour",
      entityId: workingHour.id,
      description: "Tentativa não permitida de gerenciar horários de atendimento.",
    })
    return errorResponse("Você não tem permissão para gerenciar horários de atendimento.", 403)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse("Requisição inválida.", 400)
  }

  const parsed = workingHourFormSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "Dados inválidos.", 422)
  }

  const { dayOfWeek, startTime, endTime, active } = parsed.data

  try {
    if (active) {
      const existing = await prisma.workingHour.findMany({
        where: { clinicId: auth.user.clinicId, professionalId: professional.id, dayOfWeek },
        select: { id: true, dayOfWeek: true, startTime: true, endTime: true, active: true },
      })
      const overlap = findOverlappingWorkingHour(
        { dayOfWeek, startTime, endTime },
        existing,
        workingHour.id
      )
      if (overlap) {
        return errorResponse(
          `Já existe um horário ativo nesse dia que se sobrepõe (${overlap.startTime}–${overlap.endTime}).`,
          409
        )
      }
    }

    const updated = await prisma.workingHour.update({
      where: { id: workingHour.id },
      data: { dayOfWeek, startTime, endTime, active },
      select: { id: true },
    })

    // Distinguish a pure activate/deactivate toggle from a broader edit, so
    // the audit trail reads naturally either way.
    const onlyStatusChanged =
      workingHour.dayOfWeek === dayOfWeek &&
      workingHour.startTime === startTime &&
      workingHour.endTime === endTime &&
      workingHour.active !== active

    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: onlyStatusChanged
        ? AuditAction.WORKING_HOUR_STATUS_CHANGED
        : AuditAction.WORKING_HOUR_UPDATED,
      entity: "WorkingHour",
      entityId: updated.id,
      description: onlyStatusChanged
        ? `Horário de atendimento do profissional ${professional.name} foi ${active ? "ativado" : "inativado"}.`
        : `Horário de atendimento do profissional ${professional.name} foi atualizado.`,
      metadata: { dayOfWeek, startTime, endTime, active },
    })

    return successResponse({ id: updated.id })
  } catch (error) {
    return errorResponse("Não foi possível atualizar o horário de atendimento.", 500, {
      code: "INTERNAL_ERROR",
      logContext: "professionals.working-hours.update",
      logError: error,
      logMetadata: { clinicId: auth.user.clinicId, workingHourId: workingHour.id },
    })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ professionalId: string; workingHourId: string }> }
) {
  const auth = await requireApiUser()
  if (!auth.ok) {
    return errorResponse(auth.message, auth.status)
  }

  const { professionalId, workingHourId } = await params
  const { professional, workingHour } = await loadScoped(auth.user.clinicId, professionalId, workingHourId)

  if (!professional || !workingHour) {
    return errorResponse("Horário de atendimento não encontrado.", 404)
  }

  if (!canManageWorkingHours(auth.user.role)) {
    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.PROFESSIONAL_ACCESS_DENIED,
      entity: "WorkingHour",
      entityId: workingHour.id,
      description: "Tentativa não permitida de remover horário de atendimento.",
    })
    return errorResponse("Você não tem permissão para gerenciar horários de atendimento.", 403)
  }

  try {
    // WorkingHour is purely operational configuration (not a patient/clinical
    // event), so it's fine to delete it physically — unlike Patient/User/
    // Professional/Service, which are archived/deactivated instead.
    await prisma.workingHour.delete({ where: { id: workingHour.id } })

    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.WORKING_HOUR_DELETED,
      entity: "WorkingHour",
      entityId: workingHour.id,
      description: `Horário de atendimento do profissional ${professional.name} foi removido.`,
      metadata: { dayOfWeek: workingHour.dayOfWeek, startTime: workingHour.startTime, endTime: workingHour.endTime },
    })

    return successResponse({ id: workingHour.id })
  } catch (error) {
    return errorResponse("Não foi possível remover o horário de atendimento.", 500, {
      code: "INTERNAL_ERROR",
      logContext: "professionals.working-hours.delete",
      logError: error,
      logMetadata: { clinicId: auth.user.clinicId, workingHourId: workingHour.id },
    })
  }
}
