/* eslint-disable @typescript-eslint/no-explicit-any */

/** Parsed, safe view of a WhatsApp Graph API send response. */
export interface WhatsAppSendParseResult {
  ok: boolean
  whatsappMessageId?: string
  rawContactWaId?: string
  errorCode?: string
  errorMessage?: string
}

function asString(v: unknown): string | undefined {
  if (typeof v === "string" && v.length > 0) return v
  if (typeof v === "number") return String(v)
  return undefined
}

/**
 * Parses the Graph API `/messages` response. Success → `messages[0].id`.
 * Error → `error.code`/`error.message`. Never returns the raw payload.
 */
export function parseWhatsAppSendResponse(json: unknown): WhatsAppSendParseResult {
  const j = json as any
  if (!j || typeof j !== "object") {
    return { ok: false, errorCode: "unexpected_response", errorMessage: "Resposta inesperada da API." }
  }

  const id = asString(j?.messages?.[0]?.id)
  if (id) {
    return { ok: true, whatsappMessageId: id, rawContactWaId: asString(j?.contacts?.[0]?.wa_id) }
  }

  if (j.error) {
    return {
      ok: false,
      errorCode: asString(j.error.code) ?? "graph_api_error",
      errorMessage: asString(j.error.message) ?? "Erro da API do WhatsApp.",
    }
  }

  return { ok: false, errorCode: "unexpected_response", errorMessage: "Resposta inesperada da API." }
}

/**
 * Sanitizes an error before it touches DB/audit/UI: strips access tokens
 * (Meta `EAA...`, `Bearer ...`), Authorization headers, and truncates. NEVER
 * lets a secret leak into logs/audit.
 */
export function sanitizeWhatsAppApiError(error: unknown): { code: string; message: string } {
  let raw = ""
  if (error instanceof Error) raw = error.message
  else if (typeof error === "string") raw = error
  else {
    try {
      raw = JSON.stringify(error)
    } catch {
      raw = "unknown_error"
    }
  }

  const sanitized = raw
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/EAA[A-Za-z0-9]+/g, "[redacted-token]")
    .replace(/"?authorization"?\s*:\s*"?[^",}]+/gi, "authorization: [redacted]")
    .replace(/access_token=[^&\s"]+/gi, "access_token=[redacted]")
    .slice(0, 300)

  const code = /timeout|aborted/i.test(raw) ? "timeout" : "graph_api_error"
  return { code, message: sanitized || "graph_api_error" }
}

export const WHATSAPP_SEND_FRIENDLY_ERROR =
  "Não foi possível enviar a mensagem pelo WhatsApp agora. Verifique a configuração da integração."
