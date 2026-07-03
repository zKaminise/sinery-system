import {
  type NormalizedWhatsAppEvent,
  type ParsedWebhook,
  MEDIA_FALLBACK_TEXT,
  INTERACTIVE_FALLBACK_TEXT,
  MEDIA_TYPES,
} from "@/lib/whatsapp/whatsapp-webhook-types"

/* eslint-disable @typescript-eslint/no-explicit-any */

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined
}

/** WhatsApp timestamps are unix seconds as strings. */
function toDate(ts: unknown): Date {
  const n = Number(ts)
  if (Number.isFinite(n) && n > 0) return new Date(n * 1000)
  return new Date()
}

function parseMessage(msg: any, phoneNumberId: string, businessAccountId: string | undefined, contactName: string | undefined): NormalizedWhatsAppEvent | null {
  const id = asString(msg?.id)
  const from = asString(msg?.from)
  const type = asString(msg?.type) ?? "unknown"
  if (!id || !from) return null

  let text: string
  let rawTypeMetadata: Record<string, unknown> | undefined

  if (type === "text") {
    text = asString(msg?.text?.body) ?? ""
  } else if (type === "interactive" || type === "button") {
    text = INTERACTIVE_FALLBACK_TEXT
    rawTypeMetadata = { type }
  } else if (MEDIA_TYPES.has(type)) {
    text = MEDIA_FALLBACK_TEXT
    // Capture only a media id if present — never download the media here.
    const mediaId = asString(msg?.[type]?.id)
    rawTypeMetadata = { type, ...(mediaId ? { mediaId } : {}) }
  } else {
    text = INTERACTIVE_FALLBACK_TEXT
    rawTypeMetadata = { type }
  }

  return {
    kind: "message",
    phoneNumberId,
    businessAccountId,
    whatsappMessageId: id,
    fromPhone: from,
    contactName,
    timestamp: toDate(msg?.timestamp),
    messageType: type,
    text,
    rawTypeMetadata,
  }
}

function parseStatus(st: any, phoneNumberId: string): NormalizedWhatsAppEvent | null {
  const status = asString(st?.status)
  if (!status) return null
  const errors = Array.isArray(st?.errors)
    ? st.errors.map((e: any) => ({
        code: asString(e?.code) ?? (typeof e?.code === "number" ? String(e.code) : undefined),
        title: asString(e?.title),
        message: asString(e?.message) ?? asString(e?.error_data?.details),
      }))
    : undefined
  return {
    kind: "status",
    phoneNumberId,
    whatsappMessageId: asString(st?.id),
    statusId: asString(st?.id),
    recipientPhone: asString(st?.recipient_id),
    status,
    timestamp: st?.timestamp ? toDate(st.timestamp) : undefined,
    errors,
  }
}

/**
 * Parses a WhatsApp Cloud API webhook payload into normalized events. NEVER
 * throws on malformed input — unknown structures become `ignoredReasons`. Does
 * not log or retain the raw payload.
 */
export function parseWhatsAppWebhookPayload(payload: unknown): ParsedWebhook {
  const events: NormalizedWhatsAppEvent[] = []
  const ignoredReasons: string[] = []

  const p = payload as any
  if (!p || typeof p !== "object") {
    return { events, ignoredReasons: ["not_an_object"] }
  }
  if (p.object !== "whatsapp_business_account") {
    ignoredReasons.push("unexpected_object")
  }

  const entries = Array.isArray(p.entry) ? p.entry : []
  if (entries.length === 0) ignoredReasons.push("no_entries")

  for (const entry of entries) {
    const businessAccountId = asString(entry?.id)
    const changes = Array.isArray(entry?.changes) ? entry.changes : []
    for (const change of changes) {
      const value = change?.value
      if (!value || typeof value !== "object") {
        ignoredReasons.push("missing_value")
        continue
      }
      const phoneNumberId = asString(value?.metadata?.phone_number_id)
      if (!phoneNumberId) {
        ignoredReasons.push("missing_phone_number_id")
        continue
      }

      const contactName = Array.isArray(value?.contacts)
        ? asString(value.contacts[0]?.profile?.name)
        : undefined

      const messages = Array.isArray(value?.messages) ? value.messages : []
      for (const msg of messages) {
        const event = parseMessage(msg, phoneNumberId, businessAccountId, contactName)
        if (event) events.push(event)
        else ignoredReasons.push("invalid_message")
      }

      const statuses = Array.isArray(value?.statuses) ? value.statuses : []
      for (const st of statuses) {
        const event = parseStatus(st, phoneNumberId)
        if (event) events.push(event)
        else ignoredReasons.push("invalid_status")
      }

      if (messages.length === 0 && statuses.length === 0) {
        ignoredReasons.push("no_messages_or_statuses")
      }
    }
  }

  return { events, ignoredReasons }
}
