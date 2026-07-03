import "server-only"

import { validateWhatsAppConfig, type WhatsAppSafeConfig, type WhatsAppValidationResult } from "@/lib/whatsapp/whatsapp-validate"

export const DEFAULT_GRAPH_API_VERSION = "v20.0"
export const DEFAULT_WEBHOOK_PATH = "/api/webhooks/whatsapp"

function bool(value: string | undefined): boolean {
  return (value ?? "").trim().toLowerCase() === "true"
}

function present(value: string | undefined): boolean {
  return (value ?? "").trim().length > 0
}

/**
 * SERVER-ONLY. Reads the raw WhatsApp env (including secrets). Never export the
 * result to a client component — use `getWhatsAppRuntimeConfig` for anything
 * that could reach the browser.
 */
function readEnv() {
  return {
    enabled: bool(process.env.WHATSAPP_CLOUD_API_ENABLED),
    graphApiVersion: (process.env.WHATSAPP_GRAPH_API_VERSION ?? "").trim() || DEFAULT_GRAPH_API_VERSION,
    accessToken: (process.env.WHATSAPP_ACCESS_TOKEN ?? "").trim(),
    phoneNumberId: (process.env.WHATSAPP_PHONE_NUMBER_ID ?? "").trim(),
    businessAccountId: (process.env.WHATSAPP_BUSINESS_ACCOUNT_ID ?? "").trim(),
    appId: (process.env.WHATSAPP_APP_ID ?? "").trim(),
    appSecret: (process.env.WHATSAPP_APP_SECRET ?? "").trim(),
    webhookVerifyToken: (process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? "").trim(),
    webhookPath: (process.env.WHATSAPP_WEBHOOK_PATH ?? "").trim() || DEFAULT_WEBHOOK_PATH,
    sendMessagesEnabled: bool(process.env.WHATSAPP_SEND_MESSAGES_ENABLED),
    webhookEnabled: bool(process.env.WHATSAPP_WEBHOOK_ENABLED),
    allowLiveCheck: bool(process.env.WHATSAPP_ALLOW_CONFIG_LIVE_CHECK),
    // Signature verification defaults ON (safe). Set to "false" only in dev.
    verifySignature: (process.env.WHATSAPP_VERIFY_SIGNATURE ?? "true").trim().toLowerCase() !== "false",
    autoCreatePatient: bool(process.env.WHATSAPP_AUTO_CREATE_PATIENT),
    autoProcessAssist: bool(process.env.WHATSAPP_AUTO_PROCESS_ASSIST),
  }
}

/** SERVER-ONLY. Webhook processing flags (safe booleans, no secrets). */
export function getWhatsAppWebhookFlags() {
  const env = readEnv()
  return {
    webhookEnabled: env.webhookEnabled,
    verifySignature: env.verifySignature,
    hasVerifyToken: present(env.webhookVerifyToken),
    hasAppSecret: present(env.appSecret),
    autoCreatePatient: env.autoCreatePatient,
    autoProcessAssist: env.autoProcessAssist,
    webhookPath: env.webhookPath,
  }
}

/** SERVER-ONLY. The webhook verify token value (only used by the GET handshake). */
export function getWhatsAppVerifyToken(): string {
  return readEnv().webhookVerifyToken
}

/** SERVER-ONLY. The env phone number id (dev fallback mapping). */
export function getEnvPhoneNumberId(): string {
  return readEnv().phoneNumberId
}

/**
 * SERVER-ONLY internal accessor for secret values (token/app secret/verify
 * token). Only the Graph client + webhook (future prompts) may use this.
 */
export function getWhatsAppSecrets() {
  const env = readEnv()
  return {
    accessToken: env.accessToken,
    appSecret: env.appSecret,
    webhookVerifyToken: env.webhookVerifyToken,
  }
}

/** SERVER-ONLY. Whether a live read-only Graph check is allowed (default off). */
export function isLiveCheckAllowed(): boolean {
  return readEnv().allowLiveCheck
}

/**
 * Safe, presence-only runtime config. NEVER contains secret values — safe to
 * pass down to server components and (via the API) to the browser.
 */
export function getWhatsAppRuntimeConfig(): WhatsAppSafeConfig & { effectiveMode: string } {
  const env = readEnv()
  const safe: WhatsAppSafeConfig = {
    enabled: env.enabled,
    graphApiVersion: env.graphApiVersion,
    hasAccessToken: present(env.accessToken),
    hasPhoneNumberId: present(env.phoneNumberId),
    hasBusinessAccountId: present(env.businessAccountId),
    hasAppId: present(env.appId),
    hasAppSecret: present(env.appSecret),
    hasWebhookVerifyToken: present(env.webhookVerifyToken),
    webhookPath: env.webhookPath,
    sendMessagesEnabled: env.sendMessagesEnabled,
    webhookEnabled: env.webhookEnabled,
  }
  const validation = validateWhatsAppConfig(safe)
  return { ...safe, effectiveMode: validation.status }
}

/** SERVER-ONLY. Runs the pure validator against the current env. */
export function validateWhatsAppEnv(): WhatsAppValidationResult {
  const cfg = getWhatsAppRuntimeConfig()
  return validateWhatsAppConfig(cfg)
}

/** Non-sensitive ids readable from env (for persisting phone/business ids). */
export function getWhatsAppEnvIds() {
  const env = readEnv()
  return {
    phoneNumberId: env.phoneNumberId || null,
    businessAccountId: env.businessAccountId || null,
    appId: env.appId || null,
    webhookPath: env.webhookPath,
    webhookVerifyTokenConfigured: present(env.webhookVerifyToken),
    sendMessagesEnabled: env.sendMessagesEnabled,
    webhookEnabled: env.webhookEnabled,
  }
}
