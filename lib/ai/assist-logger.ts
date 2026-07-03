import "server-only"

import { logger } from "@/lib/logger"

/**
 * Technical logging for the AI provider. Deliberately narrow: it NEVER accepts
 * or forwards the API key, the full system prompt, or full message content —
 * only safe operational metadata (mode, model, intent, token counts, error
 * codes). Message content already lives in the Message table.
 */
type SafeMeta = {
  clinicId?: string
  conversationId?: string
  mode?: string
  model?: string
  intent?: string
  confidence?: number
  tool?: string
  durationMs?: number
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  errorCode?: string
}

export function logAiEvent(message: string, meta: SafeMeta): void {
  logger.info(message, { context: "assist-ai", metadata: meta })
}

export function logAiError(message: string, meta: SafeMeta & { error?: unknown }): void {
  const { error, ...rest } = meta
  logger.error(message, { context: "assist-ai", error, metadata: rest })
}
