import { prisma } from "@/lib/prisma"
import { requireApiUser } from "@/lib/api-auth"
import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"
import { successResponse, errorResponse } from "@/lib/api-response"
import { serviceStatusSchema } from "@/lib/validators/service"
import { canChangeServiceStatus } from "@/lib/permissions"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  const auth = await requireApiUser()
  if (!auth.ok) {
    return errorResponse(auth.message, auth.status)
  }

  const { serviceId } = await params

  const target = await prisma.service.findFirst({
    where: { id: serviceId, clinicId: auth.user.clinicId },
    select: { id: true, name: true, status: true },
  })
  if (!target) {
    return errorResponse("Serviço não encontrado.", 404)
  }

  if (!canChangeServiceStatus(auth.user.role)) {
    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.SERVICE_ACCESS_DENIED,
      entity: "Service",
      entityId: target.id,
      description: "Tentativa não permitida de alterar status de serviço.",
    })
    return errorResponse("Você não tem permissão para alterar o status deste serviço.", 403)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse("Requisição inválida.", 400)
  }

  const parsed = serviceStatusSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "Dados inválidos.", 422)
  }

  const { status } = parsed.data
  const previousStatus = target.status

  try {
    const updated = await prisma.service.update({
      where: { id: target.id },
      data: { status },
      select: { id: true, name: true },
    })

    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.SERVICE_STATUS_CHANGED,
      entity: "Service",
      entityId: updated.id,
      description: `Status do serviço ${updated.name} foi alterado para ${
        status === "ACTIVE" ? "ativo" : "inativo"
      }.`,
      metadata: { from: previousStatus, to: status },
    })

    return successResponse({ id: updated.id })
  } catch (error) {
    return errorResponse("Não foi possível alterar o status do serviço.", 500, {
      code: "INTERNAL_ERROR",
      logContext: "services.status",
      logError: error,
      logMetadata: { clinicId: auth.user.clinicId, serviceId: target.id },
    })
  }
}
