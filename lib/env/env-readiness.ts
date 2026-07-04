import { validateAuthSecret } from "@/lib/auth-secret"

/**
 * Environment readiness for staging/production (Prompt 23). PURE evaluation over
 * an env snapshot (unit-testable) + a server reader. Returns only env NAMES and
 * booleans — NEVER secret values.
 */

export type AppEnv = "local" | "staging" | "production"

export interface EnvSnapshot {
  appEnv: AppEnv
  hasDatabaseUrl: boolean
  authSecret?: string
  hasAppUrl: boolean
  emailMockMode: boolean
  hasResendKey: boolean
  hasResendFrom: boolean
  asaasEnabled: boolean
  asaasMockMode: boolean
  hasAsaasKey: boolean
  hasAsaasWebhookToken: boolean
  whatsappSendEnabled: boolean
  whatsappSendMockMode: boolean
  whatsappVerifySignature: boolean
  hasWhatsappToken: boolean
  hasWhatsappAppSecret: boolean
  assistUseRealAi: boolean
  hasOpenAiKey: boolean
  hasSentryDsn: boolean
}

export interface ReadinessResult {
  appEnv: AppEnv
  readyForStaging: boolean
  readyForProduction: boolean
  /** Env NAMES that are required (given current toggles) but missing. */
  missingRequired: string[]
  /** Non-blocking recommendations. */
  warnings: string[]
  /** Issues that BLOCK production (e.g. mock modes / weak secret). */
  criticalIssues: string[]
}

export function evaluateEnvReadiness(env: EnvSnapshot): ReadinessResult {
  const missingRequired: string[] = []
  const warnings: string[] = []
  const criticalIssues: string[] = []

  // Always required.
  if (!env.hasDatabaseUrl) missingRequired.push("DATABASE_URL")
  if (!env.hasAppUrl) missingRequired.push("NEXT_PUBLIC_APP_URL")

  // AUTH_SECRET must be strong for staging/production (treat both like prod).
  const secretCheck = validateAuthSecret(env.authSecret, true)
  if (!env.authSecret) missingRequired.push("AUTH_SECRET")
  else if (!secretCheck.ok) criticalIssues.push("AUTH_SECRET fraco/placeholder (gere um segredo real ≥32 chars).")

  // Email: if not mock, Resend must be configured.
  if (!env.emailMockMode) {
    if (!env.hasResendKey) missingRequired.push("RESEND_API_KEY")
    if (!env.hasResendFrom) missingRequired.push("RESEND_FROM_EMAIL")
  }

  // Asaas: if enabled and not mock, key + webhook token required.
  if (env.asaasEnabled && !env.asaasMockMode) {
    if (!env.hasAsaasKey) missingRequired.push("ASAAS_API_KEY")
    if (!env.hasAsaasWebhookToken) missingRequired.push("ASAAS_WEBHOOK_TOKEN")
  }

  // WhatsApp: if real send, token required; if verifying signature, app secret.
  if (env.whatsappSendEnabled && !env.whatsappSendMockMode) {
    if (!env.hasWhatsappToken) missingRequired.push("WHATSAPP_ACCESS_TOKEN")
    if (env.whatsappVerifySignature && !env.hasWhatsappAppSecret) missingRequired.push("WHATSAPP_APP_SECRET")
  }

  // OpenAI: if real AI, key required.
  if (env.assistUseRealAi && !env.hasOpenAiKey) missingRequired.push("OPENAI_API_KEY")

  // Sentry is recommended (not required) in staging/prod.
  if (!env.hasSentryDsn) warnings.push("SENTRY_DSN não configurado (observabilidade recomendada em staging/produção).")

  // Production-blocking: mock modes must be OFF.
  if (env.emailMockMode) criticalIssues.push("EMAIL_MOCK_MODE=true não é permitido em produção.")
  if (env.asaasEnabled && env.asaasMockMode) criticalIssues.push("ASAAS_MOCK_MODE=true com Asaas habilitado não é permitido em produção.")
  else if (env.asaasMockMode) warnings.push("ASAAS_MOCK_MODE=true (Asaas desabilitado — sem efeito).")
  if (env.whatsappSendEnabled && env.whatsappSendMockMode) criticalIssues.push("WHATSAPP_SEND_MOCK_MODE=true com envio habilitado não é permitido em produção.")

  const stagingBaseOk = env.hasDatabaseUrl && env.hasAppUrl && !!env.authSecret && secretCheck.ok && missingRequired.length === 0

  return {
    appEnv: env.appEnv,
    // Staging allows mock modes; only needs base + configured toggles.
    readyForStaging: stagingBaseOk,
    // Production additionally forbids mock modes / weak secret.
    readyForProduction: stagingBaseOk && criticalIssues.length === 0,
    missingRequired,
    warnings,
    criticalIssues,
  }
}

// --- server reader ---------------------------------------------------------

function bool(name: string, def = false): boolean {
  const v = process.env[name]
  if (v === undefined) return def
  return v.toLowerCase() === "true"
}
function has(name: string): boolean {
  return Boolean((process.env[name] ?? "").trim())
}

export function resolveAppEnv(): AppEnv {
  const raw = (process.env.SINERY_ENV ?? process.env.APP_ENV ?? "").trim().toLowerCase()
  if (raw === "staging" || raw === "homolog" || raw === "hml") return "staging"
  if (raw === "production" || raw === "prod") return "production"
  return process.env.NODE_ENV === "production" ? "production" : "local"
}

export function getEnvReadiness(): ReadinessResult {
  return evaluateEnvReadiness({
    appEnv: resolveAppEnv(),
    hasDatabaseUrl: has("DATABASE_URL"),
    authSecret: process.env.AUTH_SECRET,
    hasAppUrl: has("NEXT_PUBLIC_APP_URL"),
    emailMockMode: (process.env.EMAIL_MOCK_MODE ?? "true").toLowerCase() !== "false",
    hasResendKey: has("RESEND_API_KEY"),
    hasResendFrom: has("RESEND_FROM_EMAIL"),
    asaasEnabled: bool("ASAAS_ENABLED"),
    asaasMockMode: (process.env.ASAAS_MOCK_MODE ?? "true").toLowerCase() !== "false",
    hasAsaasKey: has("ASAAS_API_KEY"),
    hasAsaasWebhookToken: has("ASAAS_WEBHOOK_TOKEN"),
    whatsappSendEnabled: bool("WHATSAPP_SEND_MESSAGES_ENABLED"),
    whatsappSendMockMode: bool("WHATSAPP_SEND_MOCK_MODE"),
    whatsappVerifySignature: bool("WHATSAPP_VERIFY_SIGNATURE", true),
    hasWhatsappToken: has("WHATSAPP_ACCESS_TOKEN"),
    hasWhatsappAppSecret: has("WHATSAPP_APP_SECRET"),
    assistUseRealAi: bool("ASSIST_USE_REAL_AI"),
    hasOpenAiKey: has("OPENAI_API_KEY"),
    hasSentryDsn: has("SENTRY_DSN"),
  })
}
