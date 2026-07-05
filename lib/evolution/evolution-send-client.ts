/**
 * Evolution API send client (Prompt 24). The pure helpers (body builder, mock id,
 * response parser) are unit-testable. The `sendEvolutionTextMessage` fetch takes
 * the URL/key as PARAMS (never reads env here) so this file stays free of
 * `server-only` and importable in tests. The API key is NEVER logged.
 *
 * Endpoint: POST {apiUrl}/message/sendText/{instanceName}
 * Header:   apikey: <EVOLUTION_API_KEY>
 * Body:     { "number": "<digits>", "textMessage": { "text": "<msg>" } }
 */
import { normalizeWhatsAppPhone } from "@/lib/whatsapp/whatsapp-phone"
import { evolutionErrorCode, sanitizeEvolutionError } from "@/lib/evolution/evolution-errors"
import type { EvolutionSendResult } from "@/lib/evolution/evolution-types"

export interface EvolutionSendBody {
  number: string
  textMessage: { text: string }
}

/**
 * Builds the sendText request body. The phone is digits-only; we do NOT force a
 * "55" DDI (Brazil) when it's already present — the caller passes the resolved
 * destination (e.g. "5534999990000").
 */
export function buildEvolutionSendBody(toPhone: string, text: string): EvolutionSendBody {
  return { number: normalizeWhatsAppPhone(toPhone), textMessage: { text } }
}

/** Deterministic-ish mock message id for EVOLUTION_SEND_MOCK_MODE. */
export function mockEvolutionMessageId(): string {
  return `mock_evolution_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

/** Parses an Evolution sendText response into { ok, externalMessageId }. */
export function parseEvolutionSendResponse(json: unknown): { ok: boolean; externalMessageId?: string; errorMessage?: string } {
  if (typeof json !== "object" || json === null) return { ok: false, errorMessage: "empty_response" }
  const obj = json as Record<string, unknown>

  // Success shape: { key: { id }, status } (or a flat id/messageId).
  const key = obj.key as Record<string, unknown> | undefined
  const id =
    (key && typeof key.id === "string" && key.id) ||
    (typeof obj.id === "string" && obj.id) ||
    (typeof obj.messageId === "string" && obj.messageId) ||
    ""
  if (id) return { ok: true, externalMessageId: id }

  // Error shapes: { error, message } / { status: 400, ... }.
  const message =
    (typeof obj.message === "string" && obj.message) ||
    (typeof obj.error === "string" && obj.error) ||
    "unknown_response"
  return { ok: false, errorMessage: String(message) }
}

export interface SendEvolutionParams {
  apiUrl: string
  apiKey: string
  instanceName: string
  toPhone: string
  text: string
  timeoutMs?: number
}

/**
 * Performs the real Evolution sendText HTTP call. Never logs the apikey; errors
 * are sanitized. Returns a normalized EvolutionSendResult (mock:false).
 */
export async function sendEvolutionTextMessage(params: SendEvolutionParams): Promise<EvolutionSendResult> {
  const { apiUrl, apiKey, instanceName, toPhone, text, timeoutMs = 15000 } = params
  const base = apiUrl.replace(/\/+$/, "")
  const url = `${base}/message/sendText/${encodeURIComponent(instanceName)}`
  const body = buildEvolutionSendBody(toPhone, text)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    let json: unknown = null
    try {
      json = await res.json()
    } catch {
      json = null
    }
    if (!res.ok) {
      const parsed = parseEvolutionSendResponse(json)
      return { ok: false, mock: false, errorCode: `http_${res.status}`, errorMessage: sanitizeEvolutionError(parsed.errorMessage ?? `HTTP ${res.status}`) }
    }
    const parsed = parseEvolutionSendResponse(json)
    if (parsed.ok && parsed.externalMessageId) return { ok: true, mock: false, externalMessageId: parsed.externalMessageId }
    return { ok: false, mock: false, errorCode: "bad_response", errorMessage: sanitizeEvolutionError(parsed.errorMessage ?? "bad_response") }
  } catch (error) {
    return { ok: false, mock: false, errorCode: evolutionErrorCode(error), errorMessage: sanitizeEvolutionError(error) }
  } finally {
    clearTimeout(timer)
  }
}
