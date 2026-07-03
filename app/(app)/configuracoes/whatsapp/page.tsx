import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { getCurrentUser } from "@/lib/current-user"
import { canViewWhatsAppIntegration, canManageWhatsAppIntegration } from "@/lib/permissions"
import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"
import { logger } from "@/lib/logger"
import { ErrorState } from "@/components/common/error-state"
import { WhatsAppIntegrationPanel } from "@/components/whatsapp/whatsapp-integration-panel"
import { getWhatsAppIntegration } from "@/lib/whatsapp/whatsapp-queries"

export const metadata: Metadata = {
  title: "WhatsApp Cloud API — Sinery System",
}

export default async function WhatsAppConfigPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/api/auth/clear-session")

  // Server-enforced: PROFESSIONAL has no access to the WhatsApp integration.
  if (!canViewWhatsAppIntegration(user.role)) {
    await createAuditLog({
      clinicId: user.clinicId,
      userId: user.id,
      action: AuditAction.WHATSAPP_ACCESS_DENIED,
      entity: "WhatsAppIntegration",
      description: "Tentativa de acesso à integração WhatsApp sem permissão.",
      metadata: { role: user.role },
    }).catch(() => {})
    return (
      <div className="flex flex-col gap-6">
        <h2 className="text-xl font-semibold text-foreground">WhatsApp Cloud API</h2>
        <ErrorState title="Acesso negado" description="Você não tem acesso à configuração de WhatsApp desta clínica." />
      </div>
    )
  }

  let integration: Awaited<ReturnType<typeof getWhatsAppIntegration>> | null = null
  try {
    integration = await getWhatsAppIntegration(user.clinicId)
    await createAuditLog({
      clinicId: user.clinicId,
      userId: user.id,
      action: AuditAction.WHATSAPP_INTEGRATION_VIEWED,
      entity: "WhatsAppIntegration",
      entityId: integration.id,
      description: "Integração WhatsApp visualizada.",
    })
  } catch (error) {
    logger.error("Falha ao carregar a integração WhatsApp", { context: "whatsapp", error, metadata: { clinicId: user.clinicId } })
  }

  if (!integration) {
    return (
      <div className="flex flex-col gap-6">
        <h2 className="text-xl font-semibold text-foreground">WhatsApp Cloud API</h2>
        <ErrorState description="Não foi possível carregar a integração WhatsApp. Tente novamente." />
      </div>
    )
  }

  return <WhatsAppIntegrationPanel integration={integration} canManage={canManageWhatsAppIntegration(user.role)} />
}
