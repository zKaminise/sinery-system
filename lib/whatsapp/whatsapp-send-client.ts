import "server-only"

import { buildWhatsAppGraphUrl, getWhatsAppHeaders } from "@/lib/whatsapp/whatsapp-client"
import { parseWhatsAppSendResponse, sanitizeWhatsAppApiError, type WhatsAppSendParseResult } from "@/lib/whatsapp/whatsapp-send-response"

interface SendTextInput {
  phoneNumberId: string
  toPhone: string
  text: string
  timeoutMs: number
}

/**
 * SERVER-ONLY. Calls the Graph API `POST /{phone-number-id}/messages` to send a
 * text message. Never logs the token/headers/body. Returns a safe parsed
 * result; any network/timeout error is sanitized. Only reached in real mode
 * (mock is handled by the send-service without any fetch).
 */
export async function sendWhatsAppText(input: SendTextInput): Promise<WhatsAppSendParseResult> {
  const url = buildWhatsAppGraphUrl(`${input.phoneNumberId}/messages`)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), input.timeoutMs)

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: getWhatsAppHeaders(),
      signal: controller.signal,
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: input.toPhone,
        type: "text",
        text: { preview_url: false, body: input.text },
      }),
    })

    const json = await res.json().catch(() => null)
    const parsed = parseWhatsAppSendResponse(json)
    // A non-2xx without a parseable error still counts as failure.
    if (!res.ok && parsed.ok) {
      return { ok: false, errorCode: `http_${res.status}`, errorMessage: "Erro HTTP da API do WhatsApp." }
    }
    return parsed
  } catch (error) {
    const { code, message } = sanitizeWhatsAppApiError(error)
    return { ok: false, errorCode: code, errorMessage: message }
  } finally {
    clearTimeout(timer)
  }
}
