/** Asaas + public-checkout configuration (presence only — never key values). */

export interface AsaasConfig {
  enabled: boolean
  mockMode: boolean
  environment: "sandbox" | "production"
  hasApiKey: boolean
  hasWebhookToken: boolean
  baseUrl: string
}

export function getAsaasConfig(): AsaasConfig {
  const environment = process.env.ASAAS_ENVIRONMENT === "production" ? "production" : "sandbox"
  const baseUrl =
    environment === "production"
      ? (process.env.ASAAS_BASE_URL_PRODUCTION ?? "").trim() || "https://api.asaas.com/v3"
      : (process.env.ASAAS_BASE_URL_SANDBOX ?? "").trim() || "https://sandbox.asaas.com/api/v3"
  return {
    enabled: process.env.ASAAS_ENABLED === "true",
    // Mock by default (only "false" turns it off) so no real call happens by accident.
    mockMode: (process.env.ASAAS_MOCK_MODE ?? "true").toLowerCase() !== "false",
    environment,
    hasApiKey: Boolean((process.env.ASAAS_API_KEY ?? "").trim()),
    hasWebhookToken: Boolean((process.env.ASAAS_WEBHOOK_TOKEN ?? "").trim()),
    baseUrl,
  }
}

/** True when a real Asaas API call should be made. */
export function shouldCallAsaasReal(config: AsaasConfig = getAsaasConfig()): boolean {
  return config.enabled && !config.mockMode && config.hasApiKey
}

export interface PublicCheckoutConfig {
  enabled: boolean
  allowedOrigin: string
  rateLimitPerHour: number
}

export function getPublicCheckoutConfig(): PublicCheckoutConfig {
  const raw = Number(process.env.PUBLIC_CHECKOUT_RATE_LIMIT_PER_HOUR)
  return {
    enabled: process.env.PUBLIC_CHECKOUT_ENABLED === "true",
    allowedOrigin: (process.env.PUBLIC_CHECKOUT_ALLOWED_ORIGIN ?? "").trim(),
    rateLimitPerHour: Number.isFinite(raw) && raw > 0 ? raw : 20,
  }
}
