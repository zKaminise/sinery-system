/**
 * PURE inbound normalizers (Prompt 24). Convert a provider-specific raw message
 * into the shared NormalizedInboundMessage. No env, no DB, no secrets.
 */
import type { EvolutionRawMessage } from "@/lib/evolution/evolution-types"
import type { NormalizedInboundMessage } from "@/lib/messaging/messaging-types"
import { normalizeWhatsAppPhone } from "@/lib/whatsapp/whatsapp-phone"

/** Extracts the bare phone from an Evolution remoteJid (before "@"), digits-only. */
export function phoneFromRemoteJid(remoteJid: string | null | undefined): string {
  if (!remoteJid) return ""
  const beforeAt = remoteJid.split("@")[0] ?? ""
  // JIDs can carry a device/agent suffix like ":12" — drop it before digits.
  const bare = beforeAt.split(":")[0] ?? ""
  return normalizeWhatsAppPhone(bare)
}

/** Normalizes an Evolution raw message to the shared inbound shape. */
export function normalizeEvolutionMessage(raw: EvolutionRawMessage, instanceName: string | null): NormalizedInboundMessage {
  const text = (raw.text ?? "").trim()
  const timestamp = raw.timestamp ? new Date(raw.timestamp * 1000) : new Date()
  return {
    provider: "EVOLUTION_API",
    externalMessageId: raw.keyId,
    externalConversationId: raw.remoteJid,
    instanceName: instanceName ?? undefined,
    fromPhone: phoneFromRemoteJid(raw.remoteJid),
    contactName: raw.pushName?.trim() || undefined,
    timestamp: Number.isNaN(timestamp.getTime()) ? new Date() : timestamp,
    messageType: text.length > 0 ? "text" : "unknown",
    text,
    rawTypeMetadata: raw.messageType ? { evolutionMessageType: raw.messageType } : undefined,
  }
}
