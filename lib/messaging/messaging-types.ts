/**
 * Provider-agnostic messaging types (Prompt 24). Shared by the Meta Cloud API
 * (production) and Evolution API (HML/testing) providers. PURE — no env, no DB,
 * no secrets — safe to import anywhere (incl. tests).
 */

export const MESSAGING_PROVIDERS = ["META_CLOUD_API", "EVOLUTION_API"] as const
export type MessagingProvider = (typeof MESSAGING_PROVIDERS)[number]

export const DEFAULT_MESSAGING_PROVIDER: MessagingProvider = "META_CLOUD_API"

/** Type guard for a valid provider string. */
export function isMessagingProvider(value: unknown): value is MessagingProvider {
  return typeof value === "string" && (MESSAGING_PROVIDERS as readonly string[]).includes(value)
}

/**
 * Normalizes a raw provider value (from env/DB) to a valid provider, accepting a
 * few friendly aliases. Unknown/empty → the safe default (META_CLOUD_API).
 * NEVER trusts a provider coming from the frontend without a backend re-check.
 */
export function normalizeMessagingProvider(raw: string | null | undefined): MessagingProvider {
  const v = (raw ?? "").trim().toLowerCase()
  if (v === "evolution" || v === "evolution_api" || v === "evolutionapi") return "EVOLUTION_API"
  if (v === "meta" || v === "meta_cloud" || v === "meta_cloud_api" || v === "cloud" || v === "whatsapp_cloud") return "META_CLOUD_API"
  return isMessagingProvider(raw) ? (raw as MessagingProvider) : DEFAULT_MESSAGING_PROVIDER
}

/** Human label for UI. */
export function messagingProviderLabel(provider: MessagingProvider): string {
  return provider === "EVOLUTION_API" ? "Evolution API" : "Meta Cloud API"
}

/**
 * Normalized inbound message — the single shape Conversation/Message code
 * consumes, regardless of provider.
 */
export interface NormalizedInboundMessage {
  provider: MessagingProvider
  externalMessageId: string
  externalConversationId?: string
  instanceName?: string
  phoneNumberId?: string
  fromPhone: string
  contactName?: string
  timestamp: Date
  messageType: "text" | "media" | "interactive" | "unknown"
  text: string
  rawTypeMetadata?: Record<string, unknown>
}

/** Outbound text-send request (provider chosen by the router, never the FE). */
export interface SendTextMessageParams {
  clinicId: string
  conversationId: string
  toPhone: string
  text: string
  senderType: "HUMAN" | "AI"
  sentByUserId?: string
  processingRunId?: string
  provider?: MessagingProvider
}
