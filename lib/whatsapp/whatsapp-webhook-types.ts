/** Normalized WhatsApp webhook events produced by the parser (no raw payload). */

export interface NormalizedMessageEvent {
  kind: "message"
  phoneNumberId: string
  businessAccountId?: string
  whatsappMessageId: string
  fromPhone: string
  contactName?: string
  timestamp: Date
  messageType: string
  /** Text body OR a safe fallback for unsupported/media types. */
  text: string
  /** Small, non-sensitive extra metadata (e.g. media id, interactive type). */
  rawTypeMetadata?: Record<string, unknown>
}

export interface NormalizedStatusEvent {
  kind: "status"
  phoneNumberId: string
  whatsappMessageId?: string
  statusId?: string
  recipientPhone?: string
  status: string
  timestamp?: Date
  errors?: Array<{ code?: string; title?: string; message?: string }>
}

export type NormalizedWhatsAppEvent = NormalizedMessageEvent | NormalizedStatusEvent

export interface ParsedWebhook {
  events: NormalizedWhatsAppEvent[]
  /** Reasons why parts of the payload were ignored (e.g. unknown structure). */
  ignoredReasons: string[]
}

export const MEDIA_FALLBACK_TEXT =
  "[Mensagem de mídia recebida — suporte a mídia será implementado futuramente.]"
export const INTERACTIVE_FALLBACK_TEXT =
  "[Mensagem interativa recebida — suporte completo será implementado futuramente.]"

export const MEDIA_TYPES = new Set(["image", "audio", "video", "document", "sticker", "location", "contacts"])
