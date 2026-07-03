import { prisma } from "@/lib/prisma"
import { requireApiUser } from "@/lib/api-auth"
import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"
import { successResponse, errorResponse } from "@/lib/api-response"
import { updateAiSettingsSchema } from "@/lib/validators/assist"
import { canEditAiSettings } from "@/lib/permissions"

export async function PATCH(request: Request) {
  const auth = await requireApiUser()
  if (!auth.ok) {
    return errorResponse(auth.message, auth.status)
  }

  if (!canEditAiSettings(auth.user.role)) {
    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.ASSIST_ACCESS_DENIED,
      entity: "AiSettings",
      description: "Tentativa não permitida de editar configurações da Assist.",
    })
    return errorResponse("Você não tem permissão para editar as configurações da Assist.", 403)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse("Requisição inválida.", 400)
  }

  const parsed = updateAiSettingsSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "Dados inválidos.", 422)
  }

  const data = parsed.data

  try {
    await prisma.aiSettings.upsert({
      where: { clinicId: auth.user.clinicId },
      update: data,
      create: { clinicId: auth.user.clinicId, ...data },
    })

    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.AI_SETTINGS_UPDATED,
      entity: "AiSettings",
      entityId: auth.user.clinicId,
      description: "Configurações da Sinery Assist foram atualizadas.",
      metadata: {
        enabled: data.enabled,
        canSchedule: data.canSchedule,
        canReschedule: data.canReschedule,
        canCancel: data.canCancel,
        canAnswerPricing: data.canAnswerPricing,
      },
    })

    return successResponse({ ok: true })
  } catch (error) {
    return errorResponse("Não foi possível salvar as configurações.", 500, {
      code: "INTERNAL_ERROR",
      logContext: "assist.settings.update",
      logError: error,
      logMetadata: { clinicId: auth.user.clinicId },
    })
  }
}
