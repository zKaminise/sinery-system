import "server-only"

import type { AiConfig } from "@/lib/ai/config"
import { detectIntent, extractService, extractDate } from "@/lib/assist/intent-detector"

export interface AssistModelMessage {
  role: "user" | "assistant"
  content: string
}

export interface AssistModelRequest {
  config: AiConfig
  systemPrompt: string
  /** Rendered clinic/context block (grounding). */
  contextText: string
  history: AssistModelMessage[]
  userMessage: string
  /** Signals used ONLY by the offline mock (never sent to the real API). */
  mock: { services: { id: string; name: string }[]; timeZone: string }
}

export interface AssistModelResponse {
  /** Raw JSON string the model produced (validated downstream by Zod). */
  raw: string
  usage: { inputTokens: number; outputTokens: number; totalTokens: number }
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4))
}

/**
 * Deterministic offline stub for the OpenAI call. Produces the SAME structured
 * JSON shape the real model must produce, derived from the rule-based intent
 * detector. Lets the whole real-AI code path (schema validation, tool
 * execution, audits, UI mode) be exercised with no network/cost. Enabled when
 * OPENAI_API_KEY or OPENAI_MODEL is "mock".
 */
function mockResponse(req: AssistModelRequest): AssistModelResponse {
  const intent = detectIntent(req.userMessage)
  let requestedTool: { name: string; arguments: Record<string, unknown> } | null = null
  let confidence = 0.9
  let shouldTransferToHuman = false
  let reply = "Certo! Como posso ajudar?"

  if (intent === "SCHEDULE_APPOINTMENT") {
    const service = extractService(req.userMessage, req.mock.services)
    const date = extractDate(req.userMessage, req.mock.timeZone)
    if (service && date) {
      requestedTool = {
        name: "findAvailableSlots",
        arguments: { serviceName: service.name, date, limit: 3 },
      }
      reply = "Deixa eu verificar os horários disponíveis."
    } else {
      reply = "Claro! Sobre qual serviço e para qual dia você gostaria de agendar?"
    }
  } else if (intent === "HUMAN_HELP") {
    shouldTransferToHuman = true
    reply = "Claro, vou te encaminhar para a equipe."
  } else if (intent === "UNKNOWN") {
    shouldTransferToHuman = true
    confidence = 0.4
    reply = "Não tenho certeza sobre isso."
  } else if (intent === "EMERGENCY_OR_SENSITIVE") {
    shouldTransferToHuman = true
    reply = "Vou te encaminhar para a equipe com prioridade."
  }

  const raw = JSON.stringify({ reply, intent, confidence, shouldTransferToHuman, requestedTool })
  const inputTokens = estimateTokens(
    req.systemPrompt + req.contextText + req.history.map((h) => h.content).join(" ") + req.userMessage
  )
  const outputTokens = estimateTokens(raw)
  return { raw, usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens } }
}

/**
 * Calls the assistant model and returns its raw JSON string + token usage.
 * Uses the offline mock when configured; otherwise calls the OpenAI Chat
 * Completions API with a JSON response format. Throws on API/timeout failure —
 * the provider catches it and falls back to a safe human transfer.
 */
export async function callAssistModel(req: AssistModelRequest): Promise<AssistModelResponse> {
  if (req.config.isMock) {
    return mockResponse(req)
  }

  // Dynamic import so the SDK is only loaded when real AI actually runs, and
  // the app builds/runs fine without a key.
  const OpenAI = (await import("openai")).default
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: req.config.timeoutMs,
    maxRetries: 1,
  })

  const messages = [
    { role: "system" as const, content: req.systemPrompt },
    { role: "system" as const, content: req.contextText },
    ...req.history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: req.userMessage },
  ]

  const completion = await client.chat.completions.create({
    model: req.config.model,
    messages,
    max_tokens: req.config.maxOutputTokens,
    temperature: 0.3,
    response_format: { type: "json_object" },
  })

  const raw = completion.choices[0]?.message?.content ?? ""
  const usage = completion.usage
  return {
    raw,
    usage: {
      inputTokens: usage?.prompt_tokens ?? 0,
      outputTokens: usage?.completion_tokens ?? 0,
      totalTokens: usage?.total_tokens ?? 0,
    },
  }
}
