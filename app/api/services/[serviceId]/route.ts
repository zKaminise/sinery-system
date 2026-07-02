import { prisma } from "@/lib/prisma"
import { requireApiUser } from "@/lib/api-auth"
import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"
import { successResponse, errorResponse } from "@/lib/api-response"
import { serviceFormSchema } from "@/lib/validators/service"
import { canEditService } from "@/lib/permissions"

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
    select: { id: true, name: true },
  })
  if (!target) {
    return errorResponse("Serviço não encontrado.", 404)
  }

  if (!canEditService(auth.user.role)) {
    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.SERVICE_ACCESS_DENIED,
      entity: "Service",
      entityId: target.id,
      description: "Tentativa não permitida de editar serviço.",
    })
    return errorResponse("Você não tem permissão para editar serviços.", 403)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse("Requisição inválida.", 400)
  }

  const parsed = serviceFormSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "Dados inválidos.", 422)
  }

  const { name, description, durationMinutes, priceInReais } = parsed.data

  try {
    const updated = await prisma.service.update({
      where: { id: target.id },
      data: {
        name,
        description: description ?? null,
        durationMinutes,
        priceInCents: priceInReais !== undefined ? Math.round(priceInReais * 100) : null,
      },
      select: { id: true, name: true },
    })

    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.SERVICE_UPDATED,
      entity: "Service",
      entityId: updated.id,
      description: `Serviço ${updated.name} foi atualizado.`,
    })

    return successResponse({ id: updated.id })
  } catch (error) {
    return errorResponse("Não foi possível atualizar o serviço.", 500, {
      code: "INTERNAL_ERROR",
      logContext: "services.update",
      logError: error,
      logMetadata: { clinicId: auth.user.clinicId, serviceId: target.id },
    })
  }
}
