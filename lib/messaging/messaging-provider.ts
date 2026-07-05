/**
 * Messaging provider surface (Prompt 24). Re-exports the provider type + helpers
 * so callers can import a single "provider" module. PURE (no env/DB/secrets).
 */
export {
  MESSAGING_PROVIDERS,
  DEFAULT_MESSAGING_PROVIDER,
  isMessagingProvider,
  normalizeMessagingProvider,
  messagingProviderLabel,
  type MessagingProvider,
  type NormalizedInboundMessage,
  type SendTextMessageParams,
} from "@/lib/messaging/messaging-types"
export { decideSendProvider, type DecideSendProviderResult } from "@/lib/messaging/messaging-router"
