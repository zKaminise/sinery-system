import { prisma } from "@/lib/prisma"
import { requireApiUser } from "@/lib/api-auth"
import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"
import { successResponse, errorResponse } from "@/lib/api-response"
import { serviceFormSchema } from "@/lib/validators/service"
import { canCreateService } from "@/lib/permissions"

export async function POST(request: Request) {
  const auth = await requireApiUser()
  if (!auth.ok) {
    return errorResponse(auth.message, auth.status)
  }

  if (!canCreateService(auth.user.role)) {
    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.SERVICE_ACCESS_DENIED,
      entity: "Service",
      description: "Tentativa não permitida de cadastrar serviço.",
    })
    return errorResponse("Você não tem permissão para cadastrar serviços.", 403)
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
    const service = await prisma.service.create({
      data: {
        clinicId: auth.user.clinicId,
        name,
        description: description ?? null,
        durationMinutes,
        priceInCents: priceInReais !== undefined ? Math.round(priceInReais * 100) : null,
        status: "ACTIVE",
      },
      select: { id: true, name: true },
    })

    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.SERVICE_CREATED,
      entity: "Service",
      entityId: service.id,
      description: `Serviço ${service.name} foi cadastrado.`,
    })

    return successResponse({ id: service.id }, 201)
  } catch (error) {
    return errorResponse("Não foi possível cadastrar o serviço.", 500, {
      code: "INTERNAL_ERROR",
      logContext: "services.create",
      logError: error,
      logMetadata: { clinicId: auth.user.clinicId },
    })
  }
}
