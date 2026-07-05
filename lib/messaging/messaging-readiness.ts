/**
 * PURE messaging/provider readiness (Prompt 24). No env, no DB, no secrets —
 * unit-testable. `evaluateEnvReadiness` (lib/env/env-readiness.ts) folds this in
 * so the deploy readiness surfaces the messaging provider state safely (NAMES/
 * booleans only, NEVER API keys, webhook secrets, or URLs with tokens).
 */
import { normalizeMessagingProvider, type MessagingProvider } from "@/lib/messaging/messaging-types"

export type MessagingAppEnv = "local" | "staging" | "production"

export interface MessagingReadinessInput {
  appEnv: MessagingAppEnv
  /** Raw MESSAGING_PROVIDER env value. */
  provider: string | null | undefined
  evolutionEnabled: boolean
  /** Has EVOLUTION_API_URL. */
  hasEvolutionUrl: boolean
  /** Has EVOLUTION_API_KEY. */
  hasEvolutionKey: boolean
  /** Has EVOLUTION_INSTANCE_NAME. */
  hasEvolutionInstance: boolean
  /** Has EVOLUTION_WEBHOOK_SECRET. */
  hasEvolutionWebhookSecret: boolean
  evolutionWebhookEnabled: boolean
  evolutionSendMessagesEnabled: boolean
  evolutionSendMockMode: boolean
  evolutionAssistReplyEnabled: boolean
  evolutionAllowedInProduction: boolean
}

export interface MessagingReadiness {
  messagingProvider: MessagingProvider
  evolutionEnabled: boolean
  /** True when Evolution has URL + key + instance (usable, ignoring mock). */
  evolutionConfigured: boolean
  evolutionWebhookEnabled: boolean
  evolutionSendMockMode: boolean
  evolutionAssistReplyEnabled: boolean
  evolutionAllowedInProduction: boolean
  /** Env NAMES that are required (given current toggles) but missing. */
  missingRequired: string[]
  warnings: string[]
  criticalIssues: string[]
}

/**
 * Pure decision. Evolution is a HML/testing provider: allowed in local/staging,
 * BLOCKED in production by default (only overridable with an explicit
 * EVOLUTION_ALLOW_IN_PRODUCTION=true, which still emits a critical warning).
 */
export function evaluateMessagingReadiness(input: MessagingReadinessInput): MessagingReadiness {
  const provider = normalizeMessagingProvider(input.provider)
  const missingRequired: string[] = []
  const warnings: string[] = []
  const criticalIssues: string[] = []

  const evolutionConfigured = input.hasEvolutionUrl && input.hasEvolutionKey && input.hasEvolutionInstance
  const usingEvolution = provider === "EVOLUTION_API"

  // Production must not silently run Evolution.
  if (input.appEnv === "production") {
    if (usingEvolution && !input.evolutionAllowedInProduction) {
      criticalIssues.push(
        "MESSAGING_PROVIDER=evolution em produção não é permitido (use META_CLOUD_API). Defina EVOLUTION_ALLOW_IN_PRODUCTION=true apenas se souber o risco."
      )
    } else if (usingEvolution && input.evolutionAllowedInProduction) {
      criticalIssues.push(
        "Evolution API habilitada em PRODUÇÃO (EVOLUTION_ALLOW_IN_PRODUCTION=true). NÃO recomendado para clientes — use a API oficial da Meta."
      )
    } else if (input.evolutionEnabled && !input.evolutionAllowedInProduction) {
      warnings.push("EVOLUTION_API_ENABLED=true em produção — mantido inativo pois o provider é META_CLOUD_API.")
    }
  }

  // Staging/HML: Evolution is the expected provider, but flag it as test-only.
  if ((input.appEnv === "staging" || input.appEnv === "local") && usingEvolution) {
    warnings.push("Evolution API é usada apenas para HML/testes. Produção deve usar a API oficial da Meta.")
    if (input.evolutionEnabled && !evolutionConfigured) {
      if (!input.hasEvolutionUrl) missingRequired.push("EVOLUTION_API_URL")
      if (!input.hasEvolutionKey) missingRequired.push("EVOLUTION_API_KEY")
      if (!input.hasEvolutionInstance) missingRequired.push("EVOLUTION_INSTANCE_NAME")
    }
    // Real send (not mock) needs the webhook secret to secure inbound.
    if (input.evolutionEnabled && !input.evolutionSendMockMode && !input.hasEvolutionWebhookSecret) {
      warnings.push("EVOLUTION_WEBHOOK_SECRET não configurado — o webhook Evolution ficará sem validação de segredo.")
    }
  }

  return {
    messagingProvider: provider,
    evolutionEnabled: input.evolutionEnabled,
    evolutionConfigured,
    evolutionWebhookEnabled: input.evolutionWebhookEnabled,
    evolutionSendMockMode: input.evolutionSendMockMode,
    evolutionAssistReplyEnabled: input.evolutionAssistReplyEnabled,
    evolutionAllowedInProduction: input.evolutionAllowedInProduction,
    missingRequired,
    warnings,
    criticalIssues,
  }
}
