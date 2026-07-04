/**
 * PURE decisions for the WhatsApp ↔ Sinery Assist flow. No DB, no env reads —
 * the server passes the current state/flags in. Unit-testable.
 */

export interface AutoProcessInput {
  channel: string
  direction: string
  senderType: string
  conversationStatus: string
  autoProcessAssist: boolean
  aiSettingsEnabled: boolean
  globalDisabled: boolean
}

/**
 * Whether an inbound WhatsApp message should auto-trigger the Assist. Only
 * INBOUND/PATIENT on a WHATSAPP conversation in AI_HANDLING, with the flags on
 * and the kill switches off. HUMAN_HANDLING/WAITING_HUMAN/CLOSED never trigger.
 */
export function shouldAutoProcessWhatsAppInbound(i: AutoProcessInput): boolean {
  return (
    i.channel === "WHATSAPP" &&
    i.direction === "INBOUND" &&
    i.senderType === "PATIENT" &&
    i.conversationStatus === "AI_HANDLING" &&
    i.autoProcessAssist &&
    i.aiSettingsEnabled &&
    !i.globalDisabled
  )
}

export type AssistReplyTarget = "SEND" | "MOCK" | "INTERNAL_ONLY"

export interface ReplyTargetInput {
  replyEnabled: boolean
  sendEnabled: boolean
  mockMode: boolean
  withinWindow: boolean
}

/**
 * Decides what to do with the Assist's reply on WhatsApp:
 * - INTERNAL_ONLY: reply/send disabled, or the 24h window expired (save only).
 * - MOCK: mock mode (no Graph API).
 * - SEND: real send.
 */
export function assistReplyTarget(i: ReplyTargetInput): AssistReplyTarget {
  if (!i.replyEnabled || !i.sendEnabled) return "INTERNAL_ONLY"
  if (!i.withinWindow) return "INTERNAL_ONLY"
  if (i.mockMode) return "MOCK"
  return "SEND"
}

/** True when another auto-reply is allowed this hour (limit <= 0 = unlimited). */
export function withinAutoReplyRateLimit(repliesLastHour: number, maxPerHour: number): boolean {
  if (maxPerHour <= 0) return true
  return repliesLastHour < maxPerHour
}

/** Assist may only ever process an inbound patient message (never AI/HUMAN/SYSTEM/status). */
export function isAssistProcessableMessage(direction: string, senderType: string): boolean {
  return direction === "INBOUND" && senderType === "PATIENT"
}
