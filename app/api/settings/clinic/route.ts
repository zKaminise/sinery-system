import { prisma } from "@/lib/prisma"
import { requireApiUser } from "@/lib/api-auth"
import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"
import { successResponse, errorResponse } from "@/lib/api-response"
import { updateClinicSchema } from "@/lib/validators/settings"

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

  const parsed = updateClinicSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "Dados inválidos.", 422)
  }

  try {
    // Tenant safety: the update is always scoped to the logged-in user's own
    // clinicId — a user can never edit another clinic.
    const clinic = await prisma.clinic.update({
      where: { id: auth.user.clinicId },
      data: parsed.data,
    })

    await createAuditLog({
      clinicId: clinic.id,
      userId: auth.user.id,
      action: AuditAction.CLINIC_UPDATED,
      entity: "Clinic",
      entityId: clinic.id,
      description: "Dados da clínica foram atualizados.",
    })

    return successResponse({ id: clinic.id })
  } catch (error) {
    return errorResponse("Não foi possível salvar os dados da clínica.", 500, {
      code: "INTERNAL_ERROR",
      logContext: "settings.clinic",
      logError: error,
      logMetadata: { clinicId: auth.user.clinicId },
    })
  }
}
