import { prisma } from "@/lib/prisma"
import { requireApiUser } from "@/lib/api-auth"
import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"
import { successResponse, errorResponse } from "@/lib/api-response"
import { updateClinicSettingsSchema } from "@/lib/validators/settings"

export async function PATCH(request: Request) {
  const auth = await requireApiUser({ ownerOrAdmin: true })
  if (!auth.ok) {
    return errorResponse(auth.message, auth.status)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse("Requisição inválida.", 400)
  }

  const parsed = updateClinicSettingsSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "Dados inválidos.", 422)
  }

  try {
    // Upsert scoped to the current clinic — creates settings if somehow absent,
    // otherwise updates. Never touches another clinic's settings.
    const settings = await prisma.clinicSettings.upsert({
      where: { clinicId: auth.user.clinicId },
      update: parsed.data,
      create: { clinicId: auth.user.clinicId, ...parsed.data },
    })

    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.CLINIC_SETTINGS_UPDATED,
      entity: "ClinicSettings",
      entityId: settings.id,
      description: "Configurações operacionais foram atualizadas.",
    })

    return successResponse({ id: settings.id })
  } catch (error) {
    return errorResponse("Não foi possível salvar as configurações operacionais.", 500, {
      code: "INTERNAL_ERROR",
      logContext: "settings.operation",
      logError: error,
      logMetadata: { clinicId: auth.user.clinicId },
    })
  }
}
