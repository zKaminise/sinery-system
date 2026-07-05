import "server-only"

import { resolveAppEnv } from "@/lib/env/env-readiness"
import { normalizeMessagingProvider, type MessagingProvider } from "@/lib/messaging/messaging-types"

/** SERVER-ONLY. Env-level default messaging provider (MESSAGING_PROVIDER). */
export function getEnvMessagingProvider(): MessagingProvider {
  return normalizeMessagingProvider(process.env.MESSAGING_PROVIDER)
}

/** SERVER-ONLY. Functional environment (APP_ENV source of truth). */
export function getMessagingAppEnv(): "local" | "staging" | "production" {
  return resolveAppEnv()
}
