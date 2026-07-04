import { NextResponse } from "next/server"

import { getAsaasConfig } from "@/lib/asaas/asaas-config"
import { verifyAsaasWebhookToken } from "@/lib/asaas/asaas-webhook"
import { processAsaasWebhookEvent } from "@/lib/asaas/asaas-checkout-service"
import { logger } from "@/lib/logger"

/**
 * Asaas payment webhook. Validates the `asaas-access-token` header against
 * ASAAS_WEBHOOK_TOKEN, is idempotent (PaymentProviderEvent.payloadHash), and
 * always returns 200 for a safely-handled event. Never logs the full payload.
 */
export async function POST(request: Request) {
  const cfg = getAsaasConfig()
  // Integration must be enabled OR in mock mode to accept webhooks at all.
  if (!cfg.enabled && !cfg.mockMode) {
    return NextResponse.json({ error: "Integração desabilitada." }, { status: 403 })
  }

  const token = request.headers.get("asaas-access-token")
  if (!verifyAsaasWebhookToken(token, (process.env.ASAAS_WEBHOOK_TOKEN ?? "").trim())) {
    return NextResponse.json({ error: "Token de webhook inválido." }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ received: true }, { status: 200 })

  try {
    const result = await processAsaasWebhookEvent(body)
    return NextResponse.json({ received: true, outcome: result.outcome }, { status: 200 })
  } catch (error) {
    logger.error("Falha ao processar webhook Asaas", { context: "asaas.webhook", error })
    // Still 200 so Asaas doesn't hammer retries for a handled-but-errored event.
    return NextResponse.json({ received: true, outcome: "error" }, { status: 200 })
  }
}
