import "server-only"

import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"
import { getAiConfig } from "@/lib/ai/config"
import { detectSensitiveOrEmergency, SAFE_SENSITIVE_REPLY } from "@/lib/ai/assist-guardrails"
import { buildAiAssistContext } from "@/lib/ai/assist-context"
import { buildSystemPrompt, buildContextText } from "@/lib/ai/assist-prompts"
import { callAssistModel } from "@/lib/ai/openai-client"
import { aiStructuredOutputSchema, MIN_CONFIDENCE } from "@/lib/ai/assist-schemas"
import { executeAssistTool } from "@/lib/ai/assist-tool-executor"
import { isDailyTokenLimitExceeded, recordAiUsage } from "@/lib/ai/assist-cost-control"
import { logAiEvent, logAiError } from "@/lib/ai/assist-logger"
import { loadAssistContext } from "@/lib/assist/context"
import { runAssistTurn, dispatchAssistIntent } from "@/lib/assist/assistant-engine"
import { detectIntent } from "@/lib/assist/intent-detector"
import { saveInboundPatientMessage, persistAssistTurn } from "@/lib/assist/process"
import type { AssistTurn, AiTurnMeta, AssistIntent, AssistReplyMessage } from "@/lib/assist/types"

export type AssistProviderMode = "RULE_BASED" | "OPENAI"

export interface AssistProviderInput {
  clinicId: string
  conversationId: string
  userId: string
  message: string
}

export interface AssistProviderResult {
  mode: AssistProviderMode
  reply: string
  intent: string
  confidence: number
  shouldTransferToHuman: boolean
  toolExecutions: { toolName: string; success: boolean; resultSummary?: string }[]
}

const ACTIVE_STEPS = new Set([
  "WAITING_SERVICE",
  "WAITING_DATE",
  "WAITING_SLOT_SELECTION",
  "WAITING_APPOINTMENT_SELECTION",
  "CONFIRM_CANCEL",
  "WAITING_NEW_DATE",
])

const GENERIC_FALLBACK =
  "Tive uma dificuldade para processar sua solicitação agora. Vou chamar alguém da equipe para te ajudar."

function ai(content: string): AssistReplyMessage {
  return { senderType: "AI", content }
}

/** Builds a safe "transfer to human" turn (optionally with an extra audit). */
function transferTurn(
  conversationId: string,
  message: string,
  intent: AssistIntent,
  reason: string,
  extraAudit?: AssistTurn["audits"][number]
): AssistTurn {
  const audits: AssistTurn["audits"] = []
  if (extraAudit) audits.push(extraAudit)
  audits.push({
    action: AuditAction.ASSIST_TRANSFERRED_TO_HUMAN,
    description: "A Sinery Assist transferiu a conversa para atendimento humano.",
    metadata: { conversationId, reason },
  })
  return {
    replies: [ai(message), { senderType: "SYSTEM", content: "Conversa transferida para atendimento humano pela Sinery Assist." }],
    flow: { intent, step: "TRANSFERRED_TO_HUMAN" },
    status: "WAITING_HUMAN",
    audits,
  }
}

function toResult(mode: AssistProviderMode, turn: AssistTurn, intent: string, confidence: number, tools: AssistProviderResult["toolExecutions"]): AssistProviderResult {
  const firstAi = turn.replies.find((r) => r.senderType === "AI")
  return {
    mode,
    reply: firstAi?.content ?? "",
    intent,
    confidence,
    shouldTransferToHuman: turn.status === "WAITING_HUMAN",
    toolExecutions: tools,
  }
}

/**
 * Single entry point for a simulated patient message. Decides between the
 * deterministic rule-based simulator and the real OpenAI provider, enforces
 * the safety guardrail first, and always falls back to a safe human transfer
 * on any failure. Persistence is shared with the rule-based engine.
 */
export async function processAssistMessage(input: AssistProviderInput): Promise<AssistProviderResult> {
  const { clinicId, conversationId, userId, message } = input
  const cfg = getAiConfig()

  await saveInboundPatientMessage(clinicId, conversationId, userId, message)

  // 1. Safety guardrail — never send sensitive/clinical messages to the model.
  if (detectSensitiveOrEmergency(message)) {
    const turn = transferTurn(conversationId, SAFE_SENSITIVE_REPLY, "EMERGENCY_OR_SENSITIVE", "sensitive_message", {
      action: AuditAction.ASSIST_SENSITIVE_MESSAGE_DETECTED,
      description: "Mensagem sensível/emergência detectada — não enviada à IA.",
      metadata: { conversationId },
    })
    const aiMeta: AiTurnMeta = {
      mode: cfg.useRealAi ? "OPENAI" : "RULE_BASED",
      intent: "EMERGENCY_OR_SENSITIVE",
      confidence: 1,
      fallbackReason: "sensitive_message",
    }
    await persistAssistTurn(clinicId, conversationId, userId, turn, aiMeta)
    return toResult(aiMeta.mode, turn, "EMERGENCY_OR_SENSITIVE", 1, [])
  }

  const ruleCtx = await loadAssistContext(clinicId, conversationId, message)
  if (!ruleCtx) {
    // Conversation vanished mid-flight — transfer safely.
    const turn = transferTurn(conversationId, GENERIC_FALLBACK, "UNKNOWN", "context_unavailable")
    await persistAssistTurn(clinicId, conversationId, userId, turn, { mode: "RULE_BASED", fallbackReason: "context_unavailable" })
    return toResult("RULE_BASED", turn, "UNKNOWN", 0, [])
  }

  const isContinuation = Boolean(ruleCtx.flow && ACTIVE_STEPS.has(ruleCtx.flow.step))

  // 2. Rule-based path: real AI off, OR a multi-turn flow already in progress
  //    (deterministic state machine drives "1"/"sim" replies — the AI is only
  //    used to kick off fresh intents).
  if (!cfg.useRealAi || isContinuation) {
    const turn = await runAssistTurn(ruleCtx)
    const mode: AssistProviderMode = cfg.useRealAi ? "OPENAI" : "RULE_BASED"
    const intent = detectIntent(message)
    const aiMeta: AiTurnMeta = { mode, intent, confidence: 1 }
    await persistAssistTurn(clinicId, conversationId, userId, turn, aiMeta)
    if (!cfg.useRealAi) {
      await createAuditLog({
        clinicId,
        userId,
        action: AuditAction.ASSIST_RULE_BASED_FALLBACK_USED,
        entity: "Conversation",
        entityId: conversationId,
        description: "Sinery Assist respondeu pelo simulador por regras.",
        metadata: { conversationId, reason: cfg.hasApiKey ? "real_ai_disabled" : "no_api_key" },
      })
      await recordAiUsage({ clinicId, conversationId, provider: "RULE_BASED", success: true })
    }
    return toResult(mode, turn, intent, 1, [])
  }

  // 3. Real AI path (fresh message).
  if (await isDailyTokenLimitExceeded(clinicId, cfg.dailyTokenLimit)) {
    const turn = await runAssistTurn(ruleCtx)
    const aiMeta: AiTurnMeta = { mode: "RULE_BASED", intent: detectIntent(message), confidence: 1, fallbackReason: "daily_token_limit" }
    await persistAssistTurn(clinicId, conversationId, userId, turn, aiMeta)
    await createAuditLog({
      clinicId,
      userId,
      action: AuditAction.ASSIST_RULE_BASED_FALLBACK_USED,
      entity: "Conversation",
      entityId: conversationId,
      description: "Limite diário de tokens atingido — usando simulador por regras.",
      metadata: { conversationId, reason: "daily_token_limit" },
    })
    return toResult("RULE_BASED", turn, "UNKNOWN", 1, [])
  }

  const aiCtx = await buildAiAssistContext(clinicId, conversationId, cfg.maxHistoryMessages)
  if (!aiCtx) {
    const turn = transferTurn(conversationId, GENERIC_FALLBACK, "UNKNOWN", "context_unavailable")
    await persistAssistTurn(clinicId, conversationId, userId, turn, { mode: "OPENAI", fallbackReason: "context_unavailable" })
    return toResult("OPENAI", turn, "UNKNOWN", 0, [])
  }

  const systemPrompt = buildSystemPrompt(aiCtx.aiSettings.tone)
  const contextText = buildContextText(aiCtx)
  const history = aiCtx.history.slice(0, -1) // drop the just-saved current message

  let raw: string
  try {
    const started = Date.now()
    const res = await callAssistModel({
      config: cfg,
      systemPrompt,
      contextText,
      history,
      userMessage: message,
      mock: { services: aiCtx.services.map((s) => ({ id: s.id, name: s.name })), timeZone: aiCtx.timeZone },
    })
    raw = res.raw
    await recordAiUsage({ clinicId, conversationId, provider: "OPENAI", model: cfg.model, usage: res.usage, success: true })
    await createAuditLog({
      clinicId,
      userId,
      action: AuditAction.ASSIST_REAL_AI_USED,
      entity: "Conversation",
      entityId: conversationId,
      description: "Resposta gerada pela IA real (Sinery Assist).",
      metadata: { conversationId, model: cfg.model, mock: cfg.isMock, totalTokens: res.usage.totalTokens },
    })
    logAiEvent("assist real ai used", {
      clinicId,
      conversationId,
      mode: "OPENAI",
      model: cfg.model,
      durationMs: Date.now() - started,
      totalTokens: res.usage.totalTokens,
    })
  } catch (error) {
    await recordAiUsage({ clinicId, conversationId, provider: "OPENAI", model: cfg.model, success: false, errorCode: "provider_error" })
    await createAuditLog({
      clinicId,
      userId,
      action: AuditAction.ASSIST_AI_PROVIDER_FAILED,
      entity: "Conversation",
      entityId: conversationId,
      description: "Falha ao chamar o provedor de IA — transferindo para humano.",
      metadata: { conversationId, errorCode: "provider_error" },
    })
    logAiError("assist ai provider failed", { clinicId, conversationId, mode: "OPENAI", model: cfg.model, error })
    const turn = transferTurn(conversationId, GENERIC_FALLBACK, "UNKNOWN", "provider_error")
    await persistAssistTurn(clinicId, conversationId, userId, turn, { mode: "OPENAI", fallbackReason: "provider_error" })
    return toResult("OPENAI", turn, "UNKNOWN", 0, [])
  }

  // Validate the structured output.
  let output: import("@/lib/ai/assist-schemas").AiStructuredOutput
  try {
    output = aiStructuredOutputSchema.parse(JSON.parse(raw))
  } catch {
    await createAuditLog({
      clinicId,
      userId,
      action: AuditAction.ASSIST_INVALID_AI_OUTPUT,
      entity: "Conversation",
      entityId: conversationId,
      description: "Saída da IA inválida — transferindo para humano.",
      metadata: { conversationId },
    })
    const turn = transferTurn(conversationId, GENERIC_FALLBACK, "UNKNOWN", "invalid_output")
    await persistAssistTurn(clinicId, conversationId, userId, turn, { mode: "OPENAI", fallbackReason: "invalid_output" })
    return toResult("OPENAI", turn, "UNKNOWN", 0, [])
  }

  await createAuditLog({
    clinicId,
    userId,
    action: AuditAction.ASSIST_INTENT_DETECTED,
    entity: "Conversation",
    entityId: conversationId,
    description: `Intenção detectada pela IA: ${output.intent}.`,
    metadata: { conversationId, intent: output.intent, confidence: output.confidence },
  })

  let turn: AssistTurn
  let lastTool: string | undefined
  let fallbackReason: string | undefined
  const toolExecutions: AssistProviderResult["toolExecutions"] = []

  if (output.shouldTransferToHuman || output.confidence < MIN_CONFIDENCE) {
    fallbackReason = output.confidence < MIN_CONFIDENCE ? "low_confidence" : "model_transfer"
    const msg = output.reply || aiCtx.aiSettings.humanFallbackMessage || GENERIC_FALLBACK
    turn = transferTurn(conversationId, msg, output.intent, fallbackReason)
  } else if (output.requestedTool) {
    await createAuditLog({
      clinicId,
      userId,
      action: AuditAction.ASSIST_TOOL_REQUESTED,
      entity: "Conversation",
      entityId: conversationId,
      description: `IA solicitou a ferramenta ${output.requestedTool.name}.`,
      metadata: { conversationId, tool: output.requestedTool.name },
    })
    const exec = await executeAssistTool(aiCtx, output.requestedTool.name, output.requestedTool.arguments)
    lastTool = exec.toolName
    if (exec.transferred) fallbackReason = "tool_transfer"
    toolExecutions.push({ toolName: exec.toolName, success: exec.ok, resultSummary: exec.resultSummary })
    await createAuditLog({
      clinicId,
      userId,
      action: exec.ok ? AuditAction.ASSIST_TOOL_EXECUTED : AuditAction.ASSIST_TOOL_FAILED,
      entity: "Conversation",
      entityId: conversationId,
      description: `Ferramenta ${exec.toolName}: ${exec.resultSummary}.`,
      metadata: { conversationId, tool: exec.toolName, success: exec.ok },
    })
    turn = { replies: exec.replies, flow: exec.flow ?? null, status: exec.status, audits: exec.audits }
  } else {
    // No tool requested → ground the intent through the deterministic handler.
    turn = await dispatchAssistIntent(ruleCtx, output.intent)
  }

  const aiMeta: AiTurnMeta = {
    mode: "OPENAI",
    intent: output.intent,
    confidence: output.confidence,
    lastTool,
    fallbackReason,
  }
  await persistAssistTurn(clinicId, conversationId, userId, turn, aiMeta)
  return toResult("OPENAI", turn, output.intent, output.confidence, toolExecutions)
}
