/**
 * WhatsApp webhook design constants (Prompt 16 — PREPARATORY ONLY).
 *
 * The real webhook endpoint is NOT implemented in this prompt. It arrives in
 * Prompt 17 at `WHATSAPP_WEBHOOK_PATH` (default below) and will:
 *   - GET: respond to Meta's verification handshake using
 *     `hub.mode=subscribe` + `hub.verify_token === WHATSAPP_WEBHOOK_VERIFY_TOKEN`,
 *     echoing `hub.challenge`.
 *   - POST: validate the `X-Hub-Signature-256` HMAC using WHATSAPP_APP_SECRET,
 *     then create Conversation/Message rows and hand off to the Sinery Assist.
 *
 * Until `WHATSAPP_WEBHOOK_ENABLED=true` (Prompt 17), no endpoint exists and no
 * payload is ever processed.
 */
export const WHATSAPP_DEFAULT_WEBHOOK_PATH = "/api/webhooks/whatsapp"

export const WHATSAPP_WEBHOOK_HANDSHAKE_PARAMS = {
  mode: "hub.mode",
  verifyToken: "hub.verify_token",
  challenge: "hub.challenge",
} as const

export const WHATSAPP_SIGNATURE_HEADER = "x-hub-signature-256"
