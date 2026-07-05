import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"
import { getEvolutionFlags, getEvolutionSecrets } from "@/lib/evolution/evolution-config"
import { authorizeEvolutionWebhook, EVOLUTION_WEBHOOK_SECRET_HEADER } from "@/lib/evolution/evolution-webhook-security"
import { processEvolutionWebhook } from "@/lib/evolution/evolution-webhook-processor"

function text(body: string, status: number): Response {
  return new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } })
}

/**
 * GET — lightweight connectivity/health check for the Evolution webhook. Returns
 * 200 when enabled (no secret needed — it exposes nothing sensitive), 403 when
 * disabled or Evolution isn't allowed in this environment.
 */
export async function GET() {
  const flags = getEvolutionFlags()
  if (!flags.webhookEnabled || !flags.allowedHere) return text("Forbidden", 403)
  return Response.json({ ok: true, provider: "EVOLUTION_API", webhook: "ready" }, { status: 200 })
}

/**
 * POST — receives Evolution API events. Validates the shared secret (header
 * `x-sinery-evolution-secret` OR `?token=`), parses tolerantly, resolves the
 * clinic by instanceName (never from the body), and turns inbound messages into
 * Conversation/Message (idempotently) + optionally runs the Assist. Returns 200
 * for any safely processed/ignored payload; 403 ONLY for an invalid/missing
 * secret or a disabled webhook. NEVER echoes/logs the secret.
 */
export async function POST(request: Request) {
  const flags = getEvolutionFlags()
  if (!flags.webhookEnabled) {
    logger.warn("Webhook Evolution desativado — POST rejeitado", { context: "evolution.webhook" })
    return text("Forbidden", 403)
  }
  if (!flags.allowedHere) {
    logger.warn("Webhook Evolution não permitido neste ambiente — POST rejeitado", { context: "evolution.webhook" })
    return text("Forbidden", 403)
  }

  const raw = await request.text()

  const url = new URL(request.url)
  const auth = authorizeEvolutionWebhook({
    expectedSecret: getEvolutionSecrets().webhookSecret,
    headerSecret: request.headers.get(EVOLUTION_WEBHOOK_SECRET_HEADER),
    queryToken: url.searchParams.get("token"),
  })
  if (!auth.ok) {
    logger.warn("Segredo do webhook Evolution inválido/ausente — rejeitado", { context: "evolution.webhook", metadata: { reason: auth.reason } })
    const integrations = await prisma.whatsAppIntegration.findMany({ where: { enabled: true }, select: { clinicId: true } })
    for (const i of integrations) {
      await createAuditLog({ clinicId: i.clinicId, action: AuditAction.EVOLUTION_WEBHOOK_INVALID_SECRET, entity: "WhatsAppIntegration", description: "Segredo do webhook Evolution inválido ou ausente.", metadata: { reason: auth.reason } })
    }
    return text("Forbidden", 403)
  }

  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    logger.warn("Payload do webhook Evolution inválido (JSON)", { context: "evolution.webhook" })
    return Response.json({ received: false, ignored: true }, { status: 200 })
  }

  try {
    const result = await processEvolutionWebhook(payload)
    logger.info("Webhook Evolution processado", { context: "evolution.webhook", metadata: { ...result } })
    return Response.json({ ok: true, ...result }, { status: 200 })
  } catch (error) {
    logger.error("Erro ao processar webhook Evolution", { context: "evolution.webhook", error })
    return Response.json({ received: true }, { status: 200 })
  }
}
