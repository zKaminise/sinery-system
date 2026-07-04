import "server-only"

import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"
import { getAiConfig } from "@/lib/ai/config"
import { getWhatsAppAssistFlags } from "@/lib/whatsapp/whatsapp-config"
import { withinAutoReplyRateLimit } from "@/lib/whatsapp/whatsapp-assist-decisions"
import { processAssistMessage } from "@/lib/ai/assist-provider"
import { sendWhatsAppAssistReply } from "@/lib/whatsapp/whatsapp-send-service"

export type AssistTrigger = "WEBHOOK_AUTO" | "MANUAL_BUTTON" | "RETURN_TO_ASSIST"

export interface ProcessWithAssistInput {
  clinicId: string
  conversationId: string
  inboundMessageId: string
  trigger: AssistTrigger
  /** Acting user (manual button); null for webhook auto. */
  userId?: string | null
}

export type ProcessWithAssistOutcome =
  | "processed"
  | "duplicate"
  | "skipped_human_handling"
  | "skipped_waiting_human"
  | "skipped_closed"
  | "skipped_not_processable"
  | "skipped_disabled"
  | "skipped_rate_limit"
  | "failed"

export interface ProcessWithAssistResult {
  outcome: ProcessWithAssistOutcome
  deliveryStatus?: string
}

async function skip(input: ProcessWithAssistInput, action: string, reason: string, outcome: ProcessWithAssistOutcome): Promise<ProcessWithAssistResult> {
  await createAuditLog({
    clinicId: input.clinicId,
    userId: input.userId ?? null,
    action,
    entity: "Conversation",
    entityId: input.conversationId,
    description: `Processamento da Assist ignorado (${reason}).`,
    metadata: { conversationId: input.conversationId, inboundMessageId: input.inboundMessageId, reason, trigger: input.trigger },
  })
  return { outcome }
}

/**
 * The WhatsApp ↔ Sinery Assist orchestrator. Given a saved inbound WhatsApp
 * message, decides whether to run the Assist (status/flags/idempotency/rate
 * limit), runs the existing provider (reusing guardrails/risk/injection/rate
 * limits/flows), and sends the reply via WhatsApp (or keeps it internal). One
 * auto-reply per inbound (AssistProcessingRun unique on inboundMessageId).
 * Never throws into the caller.
 */
export async function processWhatsAppInboundWithAssist(input: ProcessWithAssistInput): Promise<ProcessWithAssistResult> {
  const { clinicId, conversationId, inboundMessageId, trigger } = input

  const [inbound, conversation, integration, aiSettings] = await Promise.all([
    prisma.message.findFirst({ where: { id: inboundMessageId, clinicId, conversationId }, select: { id: true, direction: true, senderType: true, content: true } }),
    prisma.conversation.findFirst({ where: { id: conversationId, clinicId }, select: { id: true, channel: true, status: true } }),
    prisma.whatsAppIntegration.findUnique({ where: { clinicId }, select: { enabled: true } }),
    prisma.aiSettings.findUnique({ where: { clinicId }, select: { enabled: true } }),
  ])

  if (!inbound || !conversation) return skip(input, AuditAction.WHATSAPP_ASSIST_PROCESSING_SKIPPED, "not_found", "skipped_not_processable")
  if (conversation.channel !== "WHATSAPP" || inbound.direction !== "INBOUND" || inbound.senderType !== "PATIENT") {
    return skip(input, AuditAction.WHATSAPP_ASSIST_PROCESSING_SKIPPED, "not_processable", "skipped_not_processable")
  }

  // Status gates — Assist only ever runs in AI_HANDLING.
  if (conversation.status === "HUMAN_HANDLING") {
    return skip(input, AuditAction.WHATSAPP_ASSIST_SKIPPED_HUMAN_HANDLING, "human_handling", "skipped_human_handling")
  }
  if (conversation.status === "WAITING_HUMAN") {
    return skip(input, AuditAction.WHATSAPP_ASSIST_SKIPPED_WAITING_HUMAN, "waiting_human", "skipped_waiting_human")
  }
  if (conversation.status === "CLOSED") {
    return skip(input, AuditAction.WHATSAPP_ASSIST_PROCESSING_SKIPPED, "closed", "skipped_closed")
  }

  // Flags / kill switches.
  const cfg = getAiConfig()
  if (cfg.globalDisabled || !integration?.enabled || !aiSettings?.enabled) {
    return skip(input, AuditAction.WHATSAPP_ASSIST_PROCESSING_SKIPPED, "disabled", "skipped_disabled")
  }

  // Idempotency — one run per inbound.
  const existingRun = await prisma.assistProcessingRun.findUnique({ where: { inboundMessageId }, select: { id: true } })
  if (existingRun) {
    await createAuditLog({
      clinicId,
      userId: input.userId ?? null,
      action: AuditAction.WHATSAPP_ASSIST_PROCESSING_DUPLICATE_IGNORED,
      entity: "Message",
      entityId: inboundMessageId,
      description: "Processamento da Assist duplicado ignorado (idempotência).",
      metadata: { conversationId, inboundMessageId },
    })
    return { outcome: "duplicate" }
  }

  // Auto-reply rate limit (per conversation per hour).
  const assistFlags = getWhatsAppAssistFlags()
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const repliesLastHour = await prisma.assistProcessingRun.count({
    where: { conversationId, createdAt: { gte: hourAgo }, status: { in: ["SENT", "INTERNAL_ONLY", "TRANSFERRED_TO_HUMAN"] } },
  })
  if (!withinAutoReplyRateLimit(repliesLastHour, assistFlags.maxAutoRepliesPerHour)) {
    return skip(input, AuditAction.WHATSAPP_ASSIST_PROCESSING_SKIPPED, "auto_reply_rate_limit", "skipped_rate_limit")
  }

  // Create the run (RUNNING). Unique inboundMessageId guards a race → duplicate.
  const baseMode = cfg.useRealAi ? (cfg.isMock ? "MOCK" : "OPENAI") : "RULE_BASED"
  let run
  try {
    run = await prisma.assistProcessingRun.create({
      data: { clinicId, conversationId, inboundMessageId, mode: baseMode, trigger, status: "RUNNING" },
      select: { id: true },
    })
  } catch {
    return { outcome: "duplicate" }
  }

  await createAuditLog({
    clinicId,
    userId: input.userId ?? null,
    action: trigger === "WEBHOOK_AUTO" ? AuditAction.WHATSAPP_ASSIST_AUTO_TRIGGERED : AuditAction.WHATSAPP_ASSIST_MANUAL_TRIGGERED,
    entity: "Conversation",
    entityId: conversationId,
    description: "Sinery Assist acionada para mensagem recebida no WhatsApp.",
    metadata: { conversationId, inboundMessageId, trigger, runId: run.id },
  })

  // Run the Assist (reuses guardrails/risk/injection/rate-limits/flows). The
  // inbound was already saved by the webhook; the AI reply is NOT persisted
  // here — we send it as a WhatsApp message below.
  let providerResult
  try {
    providerResult = await processAssistMessage({
      clinicId,
      conversationId,
      userId: null,
      message: inbound.content,
      skipSaveInbound: true,
      persistAiReplies: false,
    })
  } catch (error) {
    await prisma.assistProcessingRun.update({ where: { id: run.id }, data: { status: "FAILED", finishedAt: new Date(), errorCode: "assist_error" } })
    await prisma.conversation.update({ where: { id: conversationId }, data: { status: "WAITING_HUMAN" } }).catch(() => {})
    logger.error("Falha ao processar Assist para inbound WhatsApp", { context: "whatsapp.assist", error, metadata: { clinicId, conversationId } })
    return { outcome: "failed" }
  }

  // A human may have assumed mid-processing → do NOT send an AI reply.
  const fresh = await prisma.conversation.findUnique({ where: { id: conversationId }, select: { status: true } })
  if (fresh?.status === "HUMAN_HANDLING") {
    await prisma.assistProcessingRun.update({ where: { id: run.id }, data: { status: "SKIPPED", reason: "human_took_over", finishedAt: new Date() } })
    return skip(input, AuditAction.WHATSAPP_ASSIST_SKIPPED_HUMAN_HANDLING, "human_took_over", "skipped_human_handling")
  }

  await createAuditLog({
    clinicId,
    action: AuditAction.WHATSAPP_ASSIST_REPLY_GENERATED,
    entity: "Conversation",
    entityId: conversationId,
    description: "Resposta da Assist gerada.",
    metadata: { conversationId, runId: run.id, intent: providerResult.intent, confidence: providerResult.confidence, transfer: providerResult.shouldTransferToHuman },
  })

  // Send the reply (or keep it internal). Even a transfer sends its safe reply.
  const reply = providerResult.reply?.trim()
  let deliveryStatus = "INTERNAL_ONLY"
  if (reply) {
    const sendResult = await sendWhatsAppAssistReply({
      clinicId,
      conversationId,
      reply,
      inboundMessageId,
      processingRunId: run.id,
      trigger,
      assistMode: providerResult.mode,
      intent: providerResult.intent,
      confidence: providerResult.confidence,
    })
    deliveryStatus = sendResult.deliveryStatus
  }

  // Finalize the run status.
  const runStatus =
    providerResult.shouldTransferToHuman ? "TRANSFERRED_TO_HUMAN" : deliveryStatus === "FAILED" ? "FAILED" : deliveryStatus === "INTERNAL_ONLY" ? "INTERNAL_ONLY" : "SENT"
  await prisma.assistProcessingRun.update({
    where: { id: run.id },
    data: { status: runStatus, intent: providerResult.intent, confidence: providerResult.confidence, finishedAt: new Date() },
  })

  if (providerResult.shouldTransferToHuman) {
    await createAuditLog({
      clinicId,
      action: AuditAction.WHATSAPP_ASSIST_TRANSFERRED_TO_HUMAN,
      entity: "Conversation",
      entityId: conversationId,
      description: "A Sinery Assist transferiu a conversa para atendimento humano (WhatsApp).",
      metadata: { conversationId, runId: run.id },
    })
  }
  // On send failure, escalate to human.
  if (deliveryStatus === "FAILED") {
    await prisma.conversation.update({ where: { id: conversationId }, data: { status: "WAITING_HUMAN" } }).catch(() => {})
  }

  return { outcome: "processed", deliveryStatus }
}
