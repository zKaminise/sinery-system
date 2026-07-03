import { requireApiUser } from "@/lib/api-auth"
import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"
import { successResponse, errorResponse } from "@/lib/api-response"
import { canManageWhatsAppIntegration } from "@/lib/permissions"
import { checkWhatsAppIntegrationConfig } from "@/lib/whatsapp/whatsapp-queries"

/**
 * Verifies the WhatsApp config WITHOUT sending a message or calling the Graph
 * API. Presence/consistency checks only; persists lastConfigCheck* + audits.
 * OWNER/ADMIN only.
 */
export async function POST() {
  const auth = await requireApiUser()
  if (!auth.ok) return errorResponse(auth.message, auth.status)

  if (!canManageWhatsAppIntegration(auth.user.role)) {
    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.WHATSAPP_ACCESS_DENIED,
      entity: "WhatsAppIntegration",
      description: "Tentativa não permitida de verificar a configuração WhatsApp.",
      metadata: { role: auth.user.role },
    })
    return errorResponse("Você não tem permissão para verificar a configuração WhatsApp.", 403)
  }

  try {
    const view = await checkWhatsAppIntegrationConfig(auth.user.clinicId, auth.user.id)
    return successResponse(view)
  } catch {
    return errorResponse("Não foi possível verificar a configuração WhatsApp.", 500)
  }
}
