import "server-only"

import { getWhatsAppRuntimeConfig, validateWhatsAppEnv } from "@/lib/whatsapp/whatsapp-config"

export interface WhatsAppHealth {
  enabled: boolean
  effectiveStatus: string
  hasAccessToken: boolean
  hasPhoneNumberId: boolean
  hasBusinessAccountId: boolean
  hasAppSecret: boolean
  hasWebhookVerifyToken: boolean
  sendMessagesEnabled: boolean
  webhookEnabled: boolean
  graphApiVersion: string
}

/**
 * Safe WhatsApp health snapshot for /status and /api/health/deep. Presence-only
 * flags — NEVER the token/secret/verify token — and NO external call.
 */
export function getWhatsAppHealth(): WhatsAppHealth {
  const cfg = getWhatsAppRuntimeConfig()
  const validation = validateWhatsAppEnv()
  return {
    enabled: cfg.enabled,
    effectiveStatus: validation.status,
    hasAccessToken: cfg.hasAccessToken,
    hasPhoneNumberId: cfg.hasPhoneNumberId,
    hasBusinessAccountId: cfg.hasBusinessAccountId,
    hasAppSecret: cfg.hasAppSecret,
    hasWebhookVerifyToken: cfg.hasWebhookVerifyToken,
    sendMessagesEnabled: cfg.sendMessagesEnabled,
    webhookEnabled: cfg.webhookEnabled,
    graphApiVersion: cfg.graphApiVersion,
  }
}
