import "server-only"

import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"
import { getAiConfig } from "@/lib/ai/config"
import { SAFE_SENSITIVE_REPLY } from "@/lib/ai/assist-guardrails"
import { classifyAssistMessageRisk, isOperationalSensitive } from "@/lib/ai/assist-risk"
import { detectPromptInjection, INJECTION_REFUSAL } from "@/lib/ai/assist-injection"
import { checkAssistRateLimits } from "@/lib/ai/assist-rate-limit"
import { RATE_LIMIT_TRANSFER_MESSAGE } from "@/lib/ai/assist-rate-limit-core"
import { detectAssistLoop } from "@/lib/ai/assist-loop"
import { LOOP_TRANSFER_MESSAGE } from "@/lib/ai/assist-loop-core"
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
  /** May be null for automated (WhatsApp) processing with no acting user. */
  userId: string | null
  message: string
  /** WhatsApp flow: the inbound was already saved by the webhook. */
  skipSaveInbound?: boolean
  /** WhatsApp flow: the AI reply is sent as a WhatsApp message, not persisted here. */
  persistAiReplies?: boolean
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
  const baseMode: AssistProviderMode = cfg.useRealAi ? "OPENAI" : "RULE_BASED"
  const persistOpts = { persistAiReplies: input.persistAiReplies ?? true }

  if (!input.skipSaveInbound) {
    await saveInboundPatientMessage(clinicId, conversationId, userId, message)
  }

  // Persists a turn honoring the per-call persistAiReplies option (WhatsApp
  // sends the AI reply as a real message, so it isn't persisted here).
  const persist = (turn: AssistTurn, meta: AiTurnMeta) =>
    persistAssistTurn(clinicId, conversationId, userId, turn, meta, persistOpts)

  // Finalizes a short-circuit safety turn (persist + shape the result).
  const shortCircuit = async (turn: AssistTurn, meta: AiTurnMeta): Promise<AssistProviderResult> => {
    await persist(turn, meta)
    return toResult(meta.mode, turn, meta.intent ?? "UNKNOWN", meta.confidence ?? 1, [])
  }

  // ===== SAFETY PREFLIGHT (runs BEFORE any model call) =====

  // 1. Global kill switch — no automation at all.
  if (cfg.globalDisabled) {
    const turn = transferTurn(
      conversationId,
      "No momento o atendimento automático está indisponível. Vou chamar alguém da equipe para te ajudar.",
      "UNKNOWN",
      "global_disabled",
      {
        action: AuditAction.ASSIST_GLOBAL_DISABLED,
        description: "Sinery Assist desativada globalmente — transferida para humano.",
        metadata: { conversationId },
      }
    )
    await recordAiUsage({ clinicId, conversationId, provider: baseMode, mode: baseMode, success: false, errorCode: "GLOBAL_DISABLED" })
    return shortCircuit(turn, { mode: baseMode, intent: "UNKNOWN", confidence: 1, fallbackReason: "global_disabled" })
  }

  // 2. Prompt injection — refuse (no model call), keep the conversation open.
  const injection = detectPromptInjection(message)
  if (injection.injected) {
    const turn: AssistTurn = {
      replies: [ai(INJECTION_REFUSAL)],
      flow: null,
      audits: [
        {
          action: AuditAction.ASSIST_PROMPT_INJECTION_DETECTED,
          description: "Tentativa de prompt injection detectada — solicitação recusada.",
          metadata: { conversationId, reasons: injection.reasons.slice(0, 3) },
        },
      ],
    }
    return shortCircuit(turn, { mode: baseMode, intent: "UNKNOWN", confidence: 1, fallbackReason: "prompt_injection" })
  }

  // 3. Risk classification — HIGH/CRITICAL (and operational-sensitive MEDIUM)
  //    never reach the model; escalate safely with no diagnosis/medication.
  const risk = classifyAssistMessageRisk(message)
  if (risk.level === "CRITICAL" || risk.level === "HIGH" || isOperationalSensitive(risk)) {
    const riskAudit =
      risk.level === "CRITICAL"
        ? { action: AuditAction.ASSIST_CRITICAL_RISK_MESSAGE_DETECTED, description: "Mensagem de risco crítico detectada — transferida para humano.", metadata: { conversationId, reasons: risk.reasons.slice(0, 3) } }
        : risk.level === "HIGH"
          ? { action: AuditAction.ASSIST_HIGH_RISK_MESSAGE_DETECTED, description: "Mensagem de risco alto detectada — transferida para humano.", metadata: { conversationId, reasons: risk.reasons.slice(0, 3) } }
          : undefined
    const msg =
      risk.level === "MEDIUM"
        ? "Sobre isso, prefiro te conectar com alguém da equipe que pode resolver melhor. Já vou chamar."
        : SAFE_SENSITIVE_REPLY
    const intent = risk.level === "MEDIUM" ? "HUMAN_HELP" : "EMERGENCY_OR_SENSITIVE"
    const turn = transferTurn(conversationId, msg, intent, `${risk.level.toLowerCase()}_risk`, riskAudit)
    return shortCircuit(turn, { mode: baseMode, intent, confidence: 1, fallbackReason: `${risk.level.toLowerCase()}_risk` })
  }

  const ruleCtx = await loadAssistContext(clinicId, conversationId, message)
  if (!ruleCtx) {
    // Conversation vanished mid-flight — transfer safely.
    const turn = transferTurn(conversationId, GENERIC_FALLBACK, "UNKNOWN", "context_unavailable")
    await persist(turn, { mode: "RULE_BASED", fallbackReason: "context_unavailable" })
    return toResult("RULE_BASED", turn, "UNKNOWN", 0, [])
  }

  // 4. Clinic kill switch — AiSettings.enabled=false blocks automation.
  if (!ruleCtx.aiSettings.enabled) {
    const turn = transferTurn(
      conversationId,
      "No momento o atendimento automático está desativado para esta clínica. Vou chamar alguém da equipe.",
      "UNKNOWN",
      "clinic_disabled",
      {
        action: AuditAction.ASSIST_CLINIC_DISABLED,
        description: "Sinery Assist desativada nas configurações da clínica — transferida para humano.",
        metadata: { conversationId },
      }
    )
    await recordAiUsage({ clinicId, conversationId, provider: baseMode, mode: baseMode, success: false, errorCode: "CLINIC_DISABLED" })
    return shortCircuit(turn, { mode: baseMode, intent: "UNKNOWN", confidence: 1, fallbackReason: "clinic_disabled" })
  }

  // 5. Rate limits (per-clinic per-minute/day + per-conversation per-minute).
  const rl = await checkAssistRateLimits(clinicId, conversationId, cfg)
  if (!rl.allowed) {
    const isDaily = rl.reason === "clinic_per_day"
    const turn = transferTurn(conversationId, RATE_LIMIT_TRANSFER_MESSAGE, "UNKNOWN", rl.reason ?? "rate_limit", {
      action: isDaily ? AuditAction.ASSIST_DAILY_LIMIT_EXCEEDED : AuditAction.ASSIST_RATE_LIMIT_EXCEEDED,
      description: "Limite de uso da Sinery Assist excedido — transferida para humano.",
      metadata: { conversationId, reason: rl.reason },
    })
    await recordAiUsage({ clinicId, conversationId, provider: baseMode, mode: baseMode, success: false, errorCode: "RATE_LIMIT_EXCEEDED" })
    return shortCircuit(turn, { mode: baseMode, intent: "UNKNOWN", confidence: 1, fallbackReason: rl.reason ?? "rate_limit" })
  }

  // 6. Loop detection — repeated replies / stuck flow / repeated tool failures.
  const loop = await detectAssistLoop(clinicId, conversationId)
  if (loop.loop) {
    const turn = transferTurn(conversationId, LOOP_TRANSFER_MESSAGE, "UNKNOWN", `loop_${loop.reason}`, {
      action: AuditAction.ASSIST_LOOP_DETECTED,
      description: "Loop de conversa detectado — transferida para humano.",
      metadata: { conversationId, reason: loop.reason },
    })
    return shortCircuit(turn, { mode: baseMode, intent: "UNKNOWN", confidence: 1, fallbackReason: `loop_${loop.reason}` })
  }

  // ===== END SAFETY PREFLIGHT =====

  const isContinuation = Boolean(ruleCtx.flow && ACTIVE_STEPS.has(ruleCtx.flow.step))

  // 2. Rule-based path: real AI off, OR a multi-turn flow already in progress
  //    (deterministic state machine drives "1"/"sim" replies — the AI is only
  //    used to kick off fresh intents).
  if (!cfg.useRealAi || isContinuation) {
    const turn = await runAssistTurn(ruleCtx)
    const mode: AssistProviderMode = cfg.useRealAi ? "OPENAI" : "RULE_BASED"
    const intent = detectIntent(message)
    const aiMeta: AiTurnMeta = { mode, intent, confidence: 1 }
    await persist(turn, aiMeta)
    // Always record a usage row (rate limits count rule turns too).
    await recordAiUsage({ clinicId, conversationId, provider: "RULE_BASED", mode, success: true })
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
    }
    return toResult(mode, turn, intent, 1, [])
  }

  // 3. Real AI path (fresh message).
  if (await isDailyTokenLimitExceeded(clinicId, cfg.dailyTokenLimit)) {
    const turn = await runAssistTurn(ruleCtx)
    const aiMeta: AiTurnMeta = { mode: "RULE_BASED", intent: detectIntent(message), confidence: 1, fallbackReason: "daily_token_limit" }
    await persist(turn, aiMeta)
    await createAuditLog({
      clinicId,
      userId,
      action: AuditAction.ASSIST_DAILY_LIMIT_EXCEEDED,
      entity: "Conversation",
      entityId: conversationId,
      description: "Limite diário de tokens atingido — usando simulador por regras.",
      metadata: { conversationId, reason: "daily_token_limit" },
    })
    await recordAiUsage({ clinicId, conversationId, provider: "RULE_BASED", mode: "RULE_BASED", success: true })
    return toResult("RULE_BASED", turn, "UNKNOWN", 1, [])
  }

  const aiCtx = await buildAiAssistContext(clinicId, conversationId, cfg.maxHistoryMessages)
  if (!aiCtx) {
    const turn = transferTurn(conversationId, GENERIC_FALLBACK, "UNKNOWN", "context_unavailable")
    await persist(turn, { mode: "OPENAI", fallbackReason: "context_unavailable" })
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
    await recordAiUsage({
      clinicId,
      conversationId,
      provider: "OPENAI",
      mode: cfg.isMock ? "MOCK" : "OPENAI",
      model: cfg.model,
      usage: res.usage,
      success: true,
      latencyMs: Date.now() - started,
    })
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
    await recordAiUsage({
      clinicId,
      conversationId,
      provider: "OPENAI",
      mode: cfg.isMock ? "MOCK" : "OPENAI",
      model: cfg.model,
      success: false,
      errorCode: "provider_error",
      errorMessage: error instanceof Error ? error.message : String(error),
    })
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
    await persist(turn, { mode: "OPENAI", fallbackReason: "provider_error" })
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
    await persist(turn, { mode: "OPENAI", fallbackReason: "invalid_output" })
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
  await persist(turn, aiMeta)
  return toResult("OPENAI", turn, output.intent, output.confidence, toolExecutions)
}
