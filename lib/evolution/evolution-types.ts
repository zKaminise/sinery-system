/**
 * PURE Evolution API types (Prompt 24). No env, no DB, no secrets.
 * The Evolution webhook payload shape varies by version/config, so these are
 * intentionally loose — the parser is tolerant.
 */

/** A single inbound message record extracted from an Evolution webhook. */
export interface EvolutionRawMessage {
  /** key.id — the provider message id (idempotency). */
  keyId: string
  /** key.remoteJid — e.g. "5534999990000@s.whatsapp.net" or "...@g.us" (group). */
  remoteJid: string
  fromMe: boolean
  pushName?: string
  text: string
  messageType?: string
  /** epoch seconds if present. */
  timestamp?: number
  isGroup: boolean
}

export type EvolutionIgnoredReason =
  | "unknown_event"
  | "no_messages"
  | "unknown_payload"
  | "all_ignored_from_me_or_group"

export interface ParsedEvolutionWebhook {
  /** Normalized event token (lowercased, dots/underscores removed) or null. */
  event: string | null
  /** Raw event string as received (for audit), or null. */
  rawEvent: string | null
  instanceName: string | null
  /** Processable inbound messages (NOT fromMe, NOT group, recognizable). */
  messages: EvolutionRawMessage[]
  /** Count of records dropped because fromMe or group. */
  droppedFromMe: number
  droppedGroup: number
  ignoredReason?: EvolutionIgnoredReason
}

export interface EvolutionSendResult {
  ok: boolean
  externalMessageId?: string
  errorCode?: string
  errorMessage?: string
  mock: boolean
}
