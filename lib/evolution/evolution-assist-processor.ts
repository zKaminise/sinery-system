import "server-only"

import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"
import { getAiConfig } from "@/lib/ai/config"
import { getEvolutionFlags } from "@/lib/evolution/evolution-config"
import { withinAutoReplyRateLimit } from "@/lib/whatsapp/whatsapp-assist-decisions"
import { processAssistMessage } from "@/lib/ai/assist-provider"
import { sendEvolutionAssistReply } from "@/lib/evolution/evolution-send-service"

/** Auto-reply cap per conversation per hour (Evolution mirrors the WhatsApp policy). */
const EVOLUTION_MAX_AUTO_REPLIES_PER_HOUR = 20

export interface ProcessEvolutionAssistInput {
  clinicId: string
  conversationId: string
  inboundMessageId: string
  trigger: "WEBHOOK_AUTO" | "MANUAL_BUTTON" | "RETURN_TO_ASSIST"
  userId?: string | null
}

export type EvolutionAssistOutcome = "processed" | "duplicate" | "skipped" | "failed"

async function skip(input: ProcessEvolutionAssistInput, reason: string): Promise<{ outcome: EvolutionAssistOutcome }> {
  await createAuditLog({
    clinicId: input.clinicId,
    userId: input.userId ?? null,
    action: AuditAction.WHATSAPP_ASSIST_PROCESSING_SKIPPED,
    entity: "Conversation",
    entityId: input.conversationId,
    description: `Processamento da Assist (Evolution) ignorado (${reason}).`,
    metadata: { conversationId: input.conversationId, inboundMessageId: input.inboundMessageId, reason, provider: "EVOLUTION_API", trigger: input.trigger },
  })
  return { outcome: "skipped" }
}

/**
 * Evolution ↔ Sinery Assist orchestrator. Reuses the SAME Assist engine as
 * Meta (`processAssistMessage`) — no duplication of the AI/rule-based motor. It
 * only adapts the gates + the send path (Evolution). One auto-reply per inbound
 * (AssistProcessingRun unique). Never throws into the webhook.
 */
export async function processEvolutionInboundWithAssist(input: ProcessEvolutionAssistInput): Promise<{ outcome: EvolutionAssistOutcome; deliveryStatus?: string }> {
  const { clinicId, conversationId, inboundMessageId, trigger } = input

  const [inbound, conversation, integration, aiSettings] = await Promise.all([
    prisma.message.findFirst({ where: { id: inboundMessageId, clinicId, conversationId }, select: { id: true, direction: true, senderType: true, content: true } }),
    prisma.conversation.findFirst({ where: { id: conversationId, clinicId }, select: { id: true, channel: true, status: true } }),
    prisma.whatsAppIntegration.findUnique({ where: { clinicId }, select: { enabled: true } }),
    prisma.aiSettings.findUnique({ where: { clinicId }, select: { enabled: true } }),
  ])

  if (!inbound || !conversation) return skip(input, "not_found")
  if (conversation.channel !== "WHATSAPP" || inbound.direction !== "INBOUND" || inbound.senderType !== "PATIENT") return skip(input, "not_processable")

  // Status gates — Assist only runs in AI_HANDLING.
  if (conversation.status === "HUMAN_HANDLING") {
    await createAuditLog({ clinicId, action: AuditAction.WHATSAPP_ASSIST_SKIPPED_HUMAN_HANDLING, entity: "Conversation", entityId: conversationId, description: "Assist (Evolution) não respondeu — atendimento humano.", metadata: { conversationId, provider: "EVOLUTION_API" } })
    return { outcome: "skipped" }
  }
  if (conversation.status === "WAITING_HUMAN") return skip(input, "waiting_human")
  if (conversation.status === "CLOSED") return skip(input, "closed")

  // Flags / kill switches.
  const cfg = getAiConfig()
  const flags = getEvolutionFlags()
  if (cfg.globalDisabled || !flags.allowedHere || !integration?.enabled || !aiSettings?.enabled) return skip(input, "disabled")

  // Idempotency — one run per inbound.
  const existingRun = await prisma.assistProcessingRun.findUnique({ where: { inboundMessageId }, select: { id: true } })
  if (existingRun) {
    await createAuditLog({ clinicId, action: AuditAction.WHATSAPP_ASSIST_PROCESSING_DUPLICATE_IGNORED, entity: "Message", entityId: inboundMessageId, description: "Processamento da Assist (Evolution) duplicado ignorado.", metadata: { conversationId, inboundMessageId } })
    return { outcome: "duplicate" }
  }

  // Auto-reply rate limit (per conversation per hour).
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const repliesLastHour = await prisma.assistProcessingRun.count({ where: { conversationId, createdAt: { gte: hourAgo }, status: { in: ["SENT", "INTERNAL_ONLY", "TRANSFERRED_TO_HUMAN"] } } })
  if (!withinAutoReplyRateLimit(repliesLastHour, EVOLUTION_MAX_AUTO_REPLIES_PER_HOUR)) return skip(input, "auto_reply_rate_limit")

  const baseMode = cfg.useRealAi ? (cfg.isMock ? "MOCK" : "OPENAI") : "RULE_BASED"
  let run
  try {
    run = await prisma.assistProcessingRun.create({ data: { clinicId, conversationId, inboundMessageId, mode: baseMode, trigger, status: "RUNNING" }, select: { id: true } })
  } catch {
    return { outcome: "duplicate" }
  }

  await createAuditLog({ clinicId, action: AuditAction.EVOLUTION_ASSIST_AUTO_TRIGGERED, entity: "Conversation", entityId: conversationId, description: "Sinery Assist acionada para mensagem recebida via Evolution.", metadata: { conversationId, inboundMessageId, trigger, runId: run.id } })

  let providerResult
  try {
    providerResult = await processAssistMessage({ clinicId, conversationId, userId: null, message: inbound.content, skipSaveInbound: true, persistAiReplies: false })
  } catch (error) {
    await prisma.assistProcessingRun.update({ where: { id: run.id }, data: { status: "FAILED", finishedAt: new Date(), errorCode: "assist_error" } })
    await prisma.conversation.update({ where: { id: conversationId }, data: { status: "WAITING_HUMAN" } }).catch(() => {})
    logger.error("Falha ao processar Assist para inbound Evolution", { context: "evolution.assist", error, metadata: { clinicId, conversationId } })
    return { outcome: "failed" }
  }

  // A human may have assumed mid-processing → do NOT send an AI reply.
  const fresh = await prisma.conversation.findUnique({ where: { id: conversationId }, select: { status: true } })
  if (fresh?.status === "HUMAN_HANDLING") {
    await prisma.assistProcessingRun.update({ where: { id: run.id }, data: { status: "SKIPPED", reason: "human_took_over", finishedAt: new Date() } })
    return { outcome: "skipped" }
  }

  const reply = providerResult.reply?.trim()
  let deliveryStatus = "INTERNAL_ONLY"
  if (reply) {
    const sendResult = await sendEvolutionAssistReply({ clinicId, conversationId, reply, inboundMessageId, processingRunId: run.id, trigger, assistMode: providerResult.mode, intent: providerResult.intent, confidence: providerResult.confidence })
    deliveryStatus = sendResult.deliveryStatus
  }

  const runStatus = providerResult.shouldTransferToHuman ? "TRANSFERRED_TO_HUMAN" : deliveryStatus === "FAILED" ? "FAILED" : deliveryStatus === "INTERNAL_ONLY" ? "INTERNAL_ONLY" : "SENT"
  await prisma.assistProcessingRun.update({ where: { id: run.id }, data: { status: runStatus, intent: providerResult.intent, confidence: providerResult.confidence, finishedAt: new Date() } })

  if (providerResult.shouldTransferToHuman) {
    await createAuditLog({ clinicId, action: AuditAction.WHATSAPP_ASSIST_TRANSFERRED_TO_HUMAN, entity: "Conversation", entityId: conversationId, description: "A Sinery Assist transferiu a conversa para atendimento humano (Evolution).", metadata: { conversationId, runId: run.id, provider: "EVOLUTION_API" } })
  }
  if (deliveryStatus === "FAILED") {
    await prisma.conversation.update({ where: { id: conversationId }, data: { status: "WAITING_HUMAN" } }).catch(() => {})
  }

  return { outcome: "processed", deliveryStatus }
}
