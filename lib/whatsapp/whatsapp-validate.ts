/**
 * PURE WhatsApp config validation + status resolution (no env, no DB, no
 * secrets) — unit-testable. The server layer (whatsapp-config.ts) builds the
 * safe flags from env and calls `validateWhatsAppConfig`.
 */

export type WhatsAppIntegrationStatus =
  | "NOT_CONFIGURED"
  | "CONFIGURED"
  | "INVALID_CONFIG"
  | "DISABLED"
  | "READY_FOR_WEBHOOK"
  | "READY_FOR_SEND"
  | "ERROR"

/** Presence-only view of the WhatsApp config. NEVER contains secret values. */
export interface WhatsAppSafeConfig {
  enabled: boolean
  graphApiVersion: string
  hasAccessToken: boolean
  hasPhoneNumberId: boolean
  hasBusinessAccountId: boolean
  hasAppId: boolean
  hasAppSecret: boolean
  hasWebhookVerifyToken: boolean
  webhookPath: string
  sendMessagesEnabled: boolean
  webhookEnabled: boolean
}

export interface WhatsAppValidationResult {
  ok: boolean
  status: WhatsAppIntegrationStatus
  issues: string[]
  warnings: string[]
  safeConfig: WhatsAppSafeConfig
}

/** True when the minimum credentials to talk to the Graph API are present. */
function hasCoreCredentials(c: WhatsAppSafeConfig): boolean {
  return c.hasAccessToken && c.hasPhoneNumberId
}

/**
 * Validates the WhatsApp config and resolves the integration status. Does NOT
 * make any external call — presence/consistency checks only.
 */
export function validateWhatsAppConfig(c: WhatsAppSafeConfig): WhatsAppValidationResult {
  const issues: string[] = []
  const warnings: string[] = []

  if (c.enabled) {
    if (!c.hasAccessToken) issues.push("WHATSAPP_ACCESS_TOKEN não configurado.")
    if (!c.hasPhoneNumberId) issues.push("WHATSAPP_PHONE_NUMBER_ID não configurado.")
  }

  // Consistency: enabling send/webhook without their prerequisites is invalid.
  if (c.sendMessagesEnabled && !hasCoreCredentials(c)) {
    issues.push("Envio habilitado, mas faltam token/phone number id.")
  }
  if (c.webhookEnabled && !c.hasWebhookVerifyToken) {
    issues.push("Webhook habilitado, mas WHATSAPP_WEBHOOK_VERIFY_TOKEN não configurado.")
  }
  if (c.webhookEnabled && !c.hasAppSecret) {
    issues.push("Webhook habilitado, mas WHATSAPP_APP_SECRET não configurado (assinatura).")
  }

  if (c.enabled && !c.hasBusinessAccountId) {
    warnings.push("WHATSAPP_BUSINESS_ACCOUNT_ID recomendado, mas ausente.")
  }
  if (c.enabled && !c.hasAppSecret) {
    warnings.push("WHATSAPP_APP_SECRET será necessário para validar o webhook.")
  }
  if (c.enabled && !c.hasWebhookVerifyToken) {
    warnings.push("WHATSAPP_WEBHOOK_VERIFY_TOKEN será necessário para o webhook.")
  }

  const status = resolveStatus(c, issues)
  const ok = c.enabled && issues.length === 0 && hasCoreCredentials(c)

  return { ok, status, issues, warnings, safeConfig: c }
}

/** Deterministic status resolution used by the validator (exported for tests). */
export function resolveStatus(c: WhatsAppSafeConfig, issues: string[]): WhatsAppIntegrationStatus {
  const anythingConfigured =
    c.hasAccessToken || c.hasPhoneNumberId || c.hasBusinessAccountId || c.hasAppId

  if (!c.enabled) {
    return anythingConfigured ? "DISABLED" : "NOT_CONFIGURED"
  }

  if (issues.length > 0) return "INVALID_CONFIG"

  // enabled + no issues + core credentials present.
  if (c.sendMessagesEnabled && hasCoreCredentials(c)) return "READY_FOR_SEND"
  if (c.webhookEnabled && c.hasWebhookVerifyToken && c.hasAppSecret) return "READY_FOR_WEBHOOK"
  return "CONFIGURED"
}

/** Short human message for the resolved status (for lastConfigCheckMessage). */
export function statusMessage(result: WhatsAppValidationResult): string {
  switch (result.status) {
    case "NOT_CONFIGURED":
      return "WhatsApp não configurado. Defina as variáveis de ambiente."
    case "DISABLED":
      return "WhatsApp desativado (WHATSAPP_CLOUD_API_ENABLED=false)."
    case "INVALID_CONFIG":
      return `Configuração inválida: ${result.issues[0] ?? "verifique as variáveis."}`
    case "CONFIGURED":
      return "Configuração básica pronta. Webhook e envio ainda desativados."
    case "READY_FOR_WEBHOOK":
      return "Pronto para ativar o webhook (Prompt 17)."
    case "READY_FOR_SEND":
      return "Pronto para ativar o envio de mensagens (Prompt 18)."
    default:
      return "Estado desconhecido."
  }
}
