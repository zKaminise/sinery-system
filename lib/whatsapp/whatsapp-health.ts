import "server-only"

import { getWhatsAppRuntimeConfig, validateWhatsAppEnv, getWhatsAppWebhookFlags, getWhatsAppSendFlags, getWhatsAppAssistFlags } from "@/lib/whatsapp/whatsapp-config"

export interface WhatsAppHealth {
  enabled: boolean
  effectiveStatus: string
  hasAccessToken: boolean
  hasPhoneNumberId: boolean
  hasBusinessAccountId: boolean
  hasAppSecret: boolean
  hasWebhookVerifyToken: boolean
  sendMessagesEnabled: boolean
  sendMockMode: boolean
  require24hWindow: boolean
  autoProcessAssist: boolean
  assistReplyEnabled: boolean
  webhookEnabled: boolean
  verifySignature: boolean
  webhookPath: string
  graphApiVersion: string
}

/**
 * Safe WhatsApp health snapshot for /status and /api/health/deep. Presence-only
 * flags — NEVER the token/secret/verify token — and NO external call.
 */
export function getWhatsAppHealth(): WhatsAppHealth {
  const cfg = getWhatsAppRuntimeConfig()
  const validation = validateWhatsAppEnv()
  const webhook = getWhatsAppWebhookFlags()
  const send = getWhatsAppSendFlags()
  const assist = getWhatsAppAssistFlags()
  return {
    enabled: cfg.enabled,
    effectiveStatus: validation.status,
    hasAccessToken: cfg.hasAccessToken,
    hasPhoneNumberId: cfg.hasPhoneNumberId,
    hasBusinessAccountId: cfg.hasBusinessAccountId,
    hasAppSecret: cfg.hasAppSecret,
    hasWebhookVerifyToken: cfg.hasWebhookVerifyToken,
    sendMessagesEnabled: cfg.sendMessagesEnabled,
    sendMockMode: send.sendMockMode,
    require24hWindow: send.require24hWindow,
    autoProcessAssist: assist.autoProcessAssist,
    assistReplyEnabled: assist.assistReplyEnabled,
    webhookEnabled: cfg.webhookEnabled,
    verifySignature: webhook.verifySignature,
    webhookPath: webhook.webhookPath,
    graphApiVersion: cfg.graphApiVersion,
  }
}
