import { prisma } from "@/lib/prisma"
import { requireApiUser } from "@/lib/api-auth"
import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"
import { successResponse, errorResponse } from "@/lib/api-response"
import { patientStatusSchema } from "@/lib/validators/patient"
import { canChangePatientStatus } from "@/lib/permissions"

const statusLabels: Record<string, string> = {
  ACTIVE: "ativo",
  INACTIVE: "inativo",
  ARCHIVED: "arquivado",
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ patientId: string }> }
) {
  const auth = await requireApiUser()
  if (!auth.ok) {
    return errorResponse(auth.message, auth.status)
  }

  const { patientId } = await params

  const target = await prisma.patient.findFirst({
    where: { id: patientId, clinicId: auth.user.clinicId },
    select: { id: true, name: true, status: true },
  })
  if (!target) {
    return errorResponse("Paciente não encontrado.", 404)
  }

  // Same permission gate covers ACTIVE/INACTIVE toggling and archiving —
  // OWNER, ADMIN and RECEPTIONIST share identical patient-status rights.
  if (!canChangePatientStatus(auth.user.role)) {
    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.PATIENT_ACCESS_DENIED,
      entity: "Patient",
      entityId: target.id,
      description: "Tentativa não permitida de alterar status de paciente.",
    })
    return errorResponse("Você não tem permissão para alterar o status deste paciente.", 403)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse("Requisição inválida.", 400)
  }

  const parsed = patientStatusSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "Dados inválidos.", 422)
  }

  const { status } = parsed.data
  const previousStatus = target.status

  try {
    const updated = await prisma.patient.update({
      where: { id: target.id },
      data: { status },
      select: { id: true, name: true },
    })

    if (status === "ARCHIVED") {
      await createAuditLog({
        clinicId: auth.user.clinicId,
        userId: auth.user.id,
        action: AuditAction.PATIENT_ARCHIVED,
        entity: "Patient",
        entityId: updated.id,
        description: `Paciente ${updated.name} foi arquivado.`,
        metadata: { from: previousStatus },
      })
    } else {
      await createAuditLog({
        clinicId: auth.user.clinicId,
        userId: auth.user.id,
        action: AuditAction.PATIENT_STATUS_CHANGED,
        entity: "Patient",
        entityId: updated.id,
        description: `Status do paciente ${updated.name} foi alterado para ${statusLabels[status]}.`,
        metadata: { from: previousStatus, to: status },
      })
    }

    return successResponse({ id: updated.id })
  } catch (error) {
    return errorResponse("Não foi possível alterar o status do paciente.", 500, {
      code: "INTERNAL_ERROR",
      logContext: "patients.status",
      logError: error,
      logMetadata: { clinicId: auth.user.clinicId, patientId: target.id },
    })
  }
}
