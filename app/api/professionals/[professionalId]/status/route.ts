import { prisma } from "@/lib/prisma"
import { requireApiUser } from "@/lib/api-auth"
import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"
import { successResponse, errorResponse } from "@/lib/api-response"
import { professionalStatusSchema } from "@/lib/validators/professional"
import { canChangeProfessionalStatus } from "@/lib/permissions"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ professionalId: string }> }
) {
  const auth = await requireApiUser()
  if (!auth.ok) {
    return errorResponse(auth.message, auth.status)
  }

  const { professionalId } = await params

  const target = await prisma.professional.findFirst({
    where: { id: professionalId, clinicId: auth.user.clinicId },
    select: { id: true, name: true, status: true },
  })
  if (!target) {
    return errorResponse("Profissional não encontrado.", 404)
  }

  if (!canChangeProfessionalStatus(auth.user.role)) {
    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.PROFESSIONAL_ACCESS_DENIED,
      entity: "Professional",
      entityId: target.id,
      description: "Tentativa não permitida de alterar status de profissional.",
    })
    return errorResponse("Você não tem permissão para alterar o status deste profissional.", 403)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse("Requisição inválida.", 400)
  }

  const parsed = professionalStatusSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "Dados inválidos.", 422)
  }

  const { status } = parsed.data
  const previousStatus = target.status

  try {
    const updated = await prisma.professional.update({
      where: { id: target.id },
      data: { status },
      select: { id: true, name: true },
    })

    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.PROFESSIONAL_STATUS_CHANGED,
      entity: "Professional",
      entityId: updated.id,
      description: `Status do profissional ${updated.name} foi alterado para ${
        status === "ACTIVE" ? "ativo" : "inativo"
      }.`,
      metadata: { from: previousStatus, to: status },
    })

    return successResponse({ id: updated.id })
  } catch (error) {
    return errorResponse("Não foi possível alterar o status do profissional.", 500, {
      code: "INTERNAL_ERROR",
      logContext: "professionals.status",
      logError: error,
      logMetadata: { clinicId: auth.user.clinicId, professionalId: target.id },
    })
  }
}
