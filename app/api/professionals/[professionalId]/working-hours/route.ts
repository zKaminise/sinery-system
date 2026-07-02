import { prisma } from "@/lib/prisma"
import { requireApiUser } from "@/lib/api-auth"
import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"
import { successResponse, errorResponse } from "@/lib/api-response"
import { workingHourFormSchema, findOverlappingWorkingHour } from "@/lib/validators/working-hour"
import { canManageWorkingHours } from "@/lib/permissions"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ professionalId: string }> }
) {
  const auth = await requireApiUser()
  if (!auth.ok) {
    return errorResponse(auth.message, auth.status)
  }

  const { professionalId } = await params

  const professional = await prisma.professional.findFirst({
    where: { id: professionalId, clinicId: auth.user.clinicId },
    select: { id: true, name: true },
  })
  if (!professional) {
    return errorResponse("Profissional não encontrado.", 404)
  }

  if (!canManageWorkingHours(auth.user.role)) {
    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.PROFESSIONAL_ACCESS_DENIED,
      entity: "WorkingHour",
      entityId: professional.id,
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
    // Overlap guard: only ACTIVE blocks on the same day/professional count.
    // Scoped to clinicId + professionalId, never trusting anything from the
    // client beyond the validated day/time values.
    const existing = await prisma.workingHour.findMany({
      where: { clinicId: auth.user.clinicId, professionalId: professional.id, dayOfWeek },
      select: { id: true, dayOfWeek: true, startTime: true, endTime: true, active: true },
    })
    const overlap = findOverlappingWorkingHour({ dayOfWeek, startTime, endTime }, existing)
    if (overlap) {
      return errorResponse(
        `Já existe um horário ativo nesse dia que se sobrepõe (${overlap.startTime}–${overlap.endTime}).`,
        409
      )
    }

    const workingHour = await prisma.workingHour.create({
      data: {
        clinicId: auth.user.clinicId,
        professionalId: professional.id,
        dayOfWeek,
        startTime,
        endTime,
        active,
      },
      select: { id: true },
    })

    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.WORKING_HOUR_CREATED,
      entity: "WorkingHour",
      entityId: workingHour.id,
      description: `Horário de atendimento do profissional ${professional.name} foi criado.`,
      metadata: { dayOfWeek, startTime, endTime },
    })

    return successResponse({ id: workingHour.id }, 201)
  } catch (error) {
    return errorResponse("Não foi possível criar o horário de atendimento.", 500, {
      code: "INTERNAL_ERROR",
      logContext: "professionals.working-hours.create",
      logError: error,
      logMetadata: { clinicId: auth.user.clinicId, professionalId: professional.id },
    })
  }
}
