import "server-only"

import { resolveAppEnv } from "@/lib/env/env-readiness"

/**
 * SERVER-ONLY Evolution API config (Prompt 24). Reads EVOLUTION_* env, including
 * secrets. NEVER export secret values to a client — use the safe accessors for
 * anything that could reach the browser. Evolution is a HML/testing provider and
 * is BLOCKED in production unless EVOLUTION_ALLOW_IN_PRODUCTION=true.
 */

export const DEFAULT_EVOLUTION_WEBHOOK_PATH = "/api/webhooks/evolution"

function bool(value: string | undefined, def = false): boolean {
  const v = (value ?? "").trim().toLowerCase()
  if (v === "") return def
  return v === "true"
}
function present(value: string | undefined): boolean {
  return (value ?? "").trim().length > 0
}
function num(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(value ?? "", 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function readEnv() {
  return {
    enabled: bool(process.env.EVOLUTION_API_ENABLED),
    apiUrl: (process.env.EVOLUTION_API_URL ?? "").trim(),
    apiKey: (process.env.EVOLUTION_API_KEY ?? "").trim(),
    instanceName: (process.env.EVOLUTION_INSTANCE_NAME ?? "").trim(),
    webhookSecret: (process.env.EVOLUTION_WEBHOOK_SECRET ?? "").trim(),
    webhookPath: (process.env.EVOLUTION_WEBHOOK_PATH ?? "").trim() || DEFAULT_EVOLUTION_WEBHOOK_PATH,
    webhookEnabled: bool(process.env.EVOLUTION_WEBHOOK_ENABLED),
    sendMessagesEnabled: bool(process.env.EVOLUTION_SEND_MESSAGES_ENABLED),
    sendMockMode: bool(process.env.EVOLUTION_SEND_MOCK_MODE, true),
    autoProcessAssist: bool(process.env.EVOLUTION_AUTO_PROCESS_ASSIST),
    assistReplyEnabled: bool(process.env.EVOLUTION_ASSIST_REPLY_ENABLED),
    processingTimeoutMs: num(process.env.EVOLUTION_PROCESSING_TIMEOUT_MS, 20000),
    allowInProduction: bool(process.env.EVOLUTION_ALLOW_IN_PRODUCTION),
  }
}

/**
 * Whether Evolution may run at all in the current environment. Blocked in
 * production unless explicitly allowed. Used as a hard gate by the webhook and
 * send service so a misconfigured prod never actually uses Evolution.
 */
export function isEvolutionAllowedHere(): boolean {
  const env = readEnv()
  if (resolveAppEnv() === "production" && !env.allowInProduction) return false
  return true
}

/** SERVER-ONLY. Safe flags (booleans/ints/instanceName — NO secrets). */
export function getEvolutionFlags() {
  const env = readEnv()
  return {
    enabled: env.enabled,
    allowedHere: isEvolutionAllowedHere(),
    webhookEnabled: env.webhookEnabled,
    sendMessagesEnabled: env.sendMessagesEnabled,
    sendMockMode: env.sendMockMode,
    autoProcessAssist: env.autoProcessAssist,
    assistReplyEnabled: env.assistReplyEnabled,
    processingTimeoutMs: env.processingTimeoutMs,
    allowInProduction: env.allowInProduction,
    instanceName: env.instanceName,
    webhookPath: env.webhookPath,
    hasApiUrl: present(env.apiUrl),
    hasApiKey: present(env.apiKey),
    hasInstanceName: present(env.instanceName),
    hasWebhookSecret: present(env.webhookSecret),
  }
}

/**
 * SERVER-ONLY internal accessor for secret values (apikey / webhook secret / URL).
 * Only the send client + webhook route may use this. NEVER logged.
 */
export function getEvolutionSecrets() {
  const env = readEnv()
  return { apiUrl: env.apiUrl, apiKey: env.apiKey, webhookSecret: env.webhookSecret, instanceName: env.instanceName }
}

/** Presence-only config safe for UI / readiness (NO secret values). */
export function getEvolutionSafeConfig() {
  const f = getEvolutionFlags()
  return {
    enabled: f.enabled,
    allowedHere: f.allowedHere,
    configured: f.hasApiUrl && f.hasApiKey && f.hasInstanceName,
    webhookEnabled: f.webhookEnabled,
    sendMessagesEnabled: f.sendMessagesEnabled,
    sendMockMode: f.sendMockMode,
    autoProcessAssist: f.autoProcessAssist,
    assistReplyEnabled: f.assistReplyEnabled,
    allowInProduction: f.allowInProduction,
    instanceName: f.instanceName || null,
    webhookPath: f.webhookPath,
    hasApiUrl: f.hasApiUrl,
    hasApiKey: f.hasApiKey,
    hasWebhookSecret: f.hasWebhookSecret,
  }
}
