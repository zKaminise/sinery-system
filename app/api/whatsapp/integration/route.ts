import { requireApiUser } from "@/lib/api-auth"
import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"
import { successResponse, errorResponse } from "@/lib/api-response"
import { canManageWhatsAppIntegration, canViewWhatsAppIntegration } from "@/lib/permissions"
import { getWhatsAppIntegration, updateWhatsAppIntegration } from "@/lib/whatsapp/whatsapp-queries"
import { updateWhatsAppIntegrationSchema } from "@/lib/whatsapp/whatsapp-schemas"

/** Reads the clinic's WhatsApp integration view (never secrets). */
export async function GET() {
  const auth = await requireApiUser()
  if (!auth.ok) return errorResponse(auth.message, auth.status)

  if (!canViewWhatsAppIntegration(auth.user.role)) {
    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.WHATSAPP_ACCESS_DENIED,
      entity: "WhatsAppIntegration",
      description: "Tentativa não permitida de ver a integração WhatsApp.",
      metadata: { role: auth.user.role },
    })
    return errorResponse("Você não tem acesso à integração WhatsApp.", 403)
  }

  try {
    const view = await getWhatsAppIntegration(auth.user.clinicId)
    return successResponse(view)
  } catch {
    return errorResponse("Não foi possível carregar a integração WhatsApp.", 500)
  }
}

/** Updates editable fields (enabled/displayPhoneNumber/verifiedName). OWNER/ADMIN. */
export async function PATCH(request: Request) {
  const auth = await requireApiUser()
  if (!auth.ok) return errorResponse(auth.message, auth.status)

  if (!canManageWhatsAppIntegration(auth.user.role)) {
    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.WHATSAPP_ACCESS_DENIED,
      entity: "WhatsAppIntegration",
      description: "Tentativa não permitida de editar a integração WhatsApp.",
      metadata: { role: auth.user.role },
    })
    return errorResponse("Você não tem permissão para editar a integração WhatsApp.", 403)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse("Requisição inválida.", 400)
  }

  const parsed = updateWhatsAppIntegrationSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "Dados inválidos.", 422)
  }

  try {
    const view = await updateWhatsAppIntegration(auth.user.clinicId, auth.user.id, parsed.data)
    return successResponse(view)
  } catch {
    return errorResponse("Não foi possível atualizar a integração WhatsApp.", 500)
  }
}
