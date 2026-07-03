import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"
import {
  getWhatsAppWebhookFlags,
  getWhatsAppVerifyToken,
  getWhatsAppSecrets,
} from "@/lib/whatsapp/whatsapp-config"
import { checkWebhookVerification } from "@/lib/whatsapp/whatsapp-webhook-verify"
import { verifyWhatsAppSignature } from "@/lib/whatsapp/whatsapp-signature"
import { processWhatsAppWebhook } from "@/lib/whatsapp/whatsapp-webhook-processor"

// Meta requires plain-text responses for the GET challenge.
function text(body: string, status: number): Response {
  return new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } })
}

/**
 * GET — Meta's webhook verification handshake. Echoes `hub.challenge` (plain
 * text) when `hub.mode=subscribe` and `hub.verify_token` matches the env token.
 * Never echoes/logs the verify token. Gated by WHATSAPP_WEBHOOK_ENABLED.
 */
export async function GET(request: Request) {
  const flags = getWhatsAppWebhookFlags()
  if (!flags.webhookEnabled) {
    logger.warn("Webhook WhatsApp desativado — GET rejeitado", { context: "whatsapp.webhook" })
    return text("Forbidden", 403)
  }

  const url = new URL(request.url)
  const result = checkWebhookVerification({
    mode: url.searchParams.get("hub.mode"),
    token: url.searchParams.get("hub.verify_token"),
    challenge: url.searchParams.get("hub.challenge"),
    expectedToken: getWhatsAppVerifyToken(),
  })

  if (!result.ok) {
    logger.warn("Verificação do webhook WhatsApp falhou", {
      context: "whatsapp.webhook",
      metadata: { reason: result.reason }, // never the token value
    })
    // Best-effort audit per enabled clinic (no user context).
    const integrations = await prisma.whatsAppIntegration.findMany({ where: { enabled: true }, select: { clinicId: true } })
    for (const i of integrations) {
      await createAuditLog({
        clinicId: i.clinicId,
        action: AuditAction.WHATSAPP_WEBHOOK_VERIFICATION_FAILED,
        entity: "WhatsAppIntegration",
        description: "Verificação do webhook WhatsApp falhou.",
        metadata: { reason: result.reason },
      })
    }
    return text(result.reason === "invalid_mode" || result.reason === "missing_challenge" ? "Bad Request" : "Forbidden", result.status)
  }

  // Mark the handshake as verified on enabled integrations.
  const integrations = await prisma.whatsAppIntegration.findMany({ where: { enabled: true }, select: { id: true, clinicId: true } })
  await Promise.all(
    integrations.map(async (i) => {
      await prisma.whatsAppIntegration.update({ where: { id: i.id }, data: { lastWebhookVerifiedAt: new Date() } })
      await createAuditLog({
        clinicId: i.clinicId,
        action: AuditAction.WHATSAPP_WEBHOOK_VERIFIED,
        entity: "WhatsAppIntegration",
        entityId: i.id,
        description: "Webhook WhatsApp verificado pela Meta.",
      })
    })
  )
  logger.info("Webhook WhatsApp verificado", { context: "whatsapp.webhook" })

  return text(result.challenge, 200)
}

/**
 * POST — receives WhatsApp events from Meta. Validates the HMAC signature (when
 * enabled), parses the payload, and turns messages into Conversation/Message
 * (idempotently). NEVER sends a message or calls the Graph API. Always responds
 * 200 for a safely processed/ignored payload.
 */
export async function POST(request: Request) {
  const flags = getWhatsAppWebhookFlags()
  if (!flags.webhookEnabled) {
    logger.warn("Webhook WhatsApp desativado — POST rejeitado", { context: "whatsapp.webhook" })
    return text("Forbidden", 403)
  }

  // Raw body is required for the signature check.
  const raw = await request.text()

  if (flags.verifySignature) {
    const { appSecret } = getWhatsAppSecrets()
    const signature = request.headers.get("x-hub-signature-256")
    const valid = appSecret ? verifyWhatsAppSignature(raw, signature, appSecret) : false
    if (!valid) {
      logger.warn("Assinatura do webhook WhatsApp inválida/ausente — rejeitado", {
        context: "whatsapp.webhook",
        metadata: { hasSignature: Boolean(signature), hasAppSecret: Boolean(appSecret) },
      })
      const integrations = await prisma.whatsAppIntegration.findMany({ where: { enabled: true }, select: { clinicId: true } })
      for (const i of integrations) {
        await createAuditLog({
          clinicId: i.clinicId,
          action: AuditAction.WHATSAPP_WEBHOOK_SIGNATURE_INVALID,
          entity: "WhatsAppIntegration",
          description: "Assinatura do webhook WhatsApp inválida ou ausente.",
        })
      }
      return text("Forbidden", 403)
    }
  }

  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    logger.warn("Payload do webhook WhatsApp inválido (JSON)", { context: "whatsapp.webhook" })
    return Response.json({ received: false, ignored: true }, { status: 200 })
  }

  try {
    const result = await processWhatsAppWebhook(payload)
    logger.info("Webhook WhatsApp processado", { context: "whatsapp.webhook", metadata: { ...result } })
    return Response.json(
      { received: true, events: result.received, processed: result.processed, duplicates: result.duplicates, ignored: result.ignored },
      { status: 200 }
    )
  } catch (error) {
    // Never leak details to Meta; always ack to avoid aggressive retries.
    logger.error("Erro ao processar webhook WhatsApp", { context: "whatsapp.webhook", error })
    return Response.json({ received: true }, { status: 200 })
  }
}
