/**
 * PURE, tolerant Evolution webhook parser (Prompt 24). Evolution payloads vary
 * by version/config, so this accepts several shapes and never throws. Returns
 * only PROCESSABLE inbound messages (drops fromMe and group @g.us). No env,
 * no DB, no secrets — unit-testable.
 */
import type { EvolutionRawMessage, ParsedEvolutionWebhook } from "@/lib/evolution/evolution-types"

/** Recognized inbound events (compared after removing dots/underscores). */
const INBOUND_EVENTS = new Set(["messagesupsert", "messagereceived"])
const GROUP_SUFFIX = "@g.us"

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null
}
function str(v: unknown): string {
  return typeof v === "string" ? v : ""
}
function normalizeEvent(raw: string): string {
  return raw.toLowerCase().replace(/[._\s]/g, "")
}

function extractInstance(payload: Record<string, unknown>): string | null {
  const inst = payload.instance
  if (typeof inst === "string" && inst.trim()) return inst.trim()
  if (isRecord(inst)) {
    const name = str(inst.instanceName) || str(inst.name) || str(inst.id)
    if (name.trim()) return name.trim()
  }
  const flat = str(payload.instanceName) || str(payload.instance_name)
  return flat.trim() || null
}

/** Pulls the list of candidate message records from various `data` shapes. */
function extractRecords(payload: Record<string, unknown>): Record<string, unknown>[] {
  const data = payload.data
  if (Array.isArray(data)) return data.filter(isRecord) as Record<string, unknown>[]
  if (isRecord(data)) {
    // Some payloads nest an array under data.messages.
    if (Array.isArray((data as Record<string, unknown>).messages)) {
      return ((data as Record<string, unknown>).messages as unknown[]).filter(isRecord) as Record<string, unknown>[]
    }
    return [data]
  }
  // Fallback: a flat top-level message (e.g. { key, message } or { sender, text }).
  if (isRecord(payload.message) || isRecord(payload.key) || typeof payload.text === "string") {
    return [payload]
  }
  return []
}

function extractText(record: Record<string, unknown>): string {
  const message = isRecord(record.message) ? record.message : {}
  const conversation = str((message as Record<string, unknown>).conversation)
  if (conversation) return conversation
  const ext = (message as Record<string, unknown>).extendedTextMessage
  if (isRecord(ext)) {
    const t = str(ext.text)
    if (t) return t
  }
  return str(record.text) || str(record.body)
}

function toRawMessage(record: Record<string, unknown>): EvolutionRawMessage | null {
  const key = isRecord(record.key) ? record.key : {}
  const keyId = str(key.id) || str(record.keyId) || str(record.id)
  const remoteJid = str(key.remoteJid) || str(record.remoteJid) || str(record.sender)
  if (!keyId || !remoteJid) return null

  const text = extractText(record)
  const message = isRecord(record.message) ? record.message : {}
  const messageType =
    str(record.messageType) ||
    (str((message as Record<string, unknown>).conversation) ? "conversation" : "") ||
    (isRecord((message as Record<string, unknown>).extendedTextMessage) ? "extendedTextMessage" : "") ||
    (text ? "text" : "unknown")

  const tsRaw = record.messageTimestamp ?? record.timestamp
  const timestamp = typeof tsRaw === "number" ? tsRaw : Number.parseInt(str(tsRaw), 10) || undefined

  return {
    keyId,
    remoteJid,
    fromMe: Boolean(key.fromMe ?? record.fromMe),
    pushName: str(record.pushName) || str(record.notifyName) || str(record.contactName) || undefined,
    text,
    messageType,
    timestamp,
    isGroup: remoteJid.endsWith(GROUP_SUFFIX),
  }
}

/** Parses an Evolution webhook body into processable inbound messages. */
export function parseEvolutionWebhook(payload: unknown): ParsedEvolutionWebhook {
  if (!isRecord(payload)) {
    return { event: null, rawEvent: null, instanceName: null, messages: [], droppedFromMe: 0, droppedGroup: 0, ignoredReason: "unknown_payload" }
  }

  const rawEvent = str(payload.event) || null
  const event = rawEvent ? normalizeEvent(rawEvent) : null
  const instanceName = extractInstance(payload)
  const records = extractRecords(payload)

  const candidates = records.map(toRawMessage).filter((m): m is EvolutionRawMessage => m !== null)
  const eventLooksInbound = event === null || INBOUND_EVENTS.has(event)

  // Unknown event AND nothing that looks like a message → ignore.
  if (!eventLooksInbound && candidates.length === 0) {
    return { event, rawEvent, instanceName, messages: [], droppedFromMe: 0, droppedGroup: 0, ignoredReason: "unknown_event" }
  }

  let droppedFromMe = 0
  let droppedGroup = 0
  const messages: EvolutionRawMessage[] = []
  for (const m of candidates) {
    if (m.fromMe) {
      droppedFromMe += 1
      continue
    }
    if (m.isGroup) {
      droppedGroup += 1
      continue
    }
    messages.push(m)
  }

  let ignoredReason: ParsedEvolutionWebhook["ignoredReason"]
  if (messages.length === 0) {
    if (candidates.length > 0 && droppedFromMe + droppedGroup > 0) ignoredReason = "all_ignored_from_me_or_group"
    else if (!eventLooksInbound) ignoredReason = "unknown_event"
    else ignoredReason = "no_messages"
  }

  return { event, rawEvent, instanceName, messages, droppedFromMe, droppedGroup, ignoredReason }
}
