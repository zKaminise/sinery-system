/**
 * PURE provider-routing decision (Prompt 24). Decides which provider must send a
 * message, and blocks Evolution in production unless explicitly allowed. No env,
 * no DB — unit-testable. The actual send is dispatched in the server layer
 * (messaging-send-service), never based on a provider coming from the frontend.
 */
import { normalizeMessagingProvider, type MessagingProvider } from "@/lib/messaging/messaging-types"

export type SendProviderAppEnv = "local" | "staging" | "production"

export interface DecideSendProviderInput {
  /** Provider resolved from the clinic's integration/conversation (backend). */
  integrationProvider: string | null | undefined
  appEnv: SendProviderAppEnv
  evolutionAllowedInProduction: boolean
}

export type DecideSendProviderResult =
  | { ok: true; provider: MessagingProvider }
  | { ok: false; reason: "evolution_blocked_in_production"; provider: MessagingProvider }

/**
 * Resolves the send provider for a clinic. Evolution is blocked in production
 * unless EVOLUTION_ALLOW_IN_PRODUCTION=true. Meta is always allowed.
 */
export function decideSendProvider(input: DecideSendProviderInput): DecideSendProviderResult {
  const provider = normalizeMessagingProvider(input.integrationProvider)

  if (provider === "EVOLUTION_API" && input.appEnv === "production" && !input.evolutionAllowedInProduction) {
    return { ok: false, reason: "evolution_blocked_in_production", provider }
  }

  return { ok: true, provider }
}
