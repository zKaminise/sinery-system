import "server-only"

import { prisma } from "@/lib/prisma"
import { Prisma } from "@/lib/generated/prisma/client"
import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"
import { logger } from "@/lib/logger"
import { maskPhone, normalizeWhatsAppPhone } from "@/lib/whatsapp/whatsapp-phone"
import { getEvolutionFlags, getEvolutionSecrets } from "@/lib/evolution/evolution-config"
import { sendEvolutionTextMessage, mockEvolutionMessageId } from "@/lib/evolution/evolution-send-client"
import { EVOLUTION_SEND_FRIENDLY_ERROR } from "@/lib/evolution/evolution-errors"

/** Base OUTBOUND message metadata for Evolution (externalChannel stays WHATSAPP
 *  for UX; the provider is recorded in metadata). */
function baseMeta(extra: Record<string, unknown>) {
  return { source: "EVOLUTION_API", provider: "EVOLUTION_API", ...extra } as Prisma.InputJsonValue
}

/** Resolves the Evolution instance name to send with (integration → env). */
function resolveSendInstance(integrationInstance: string | null): string {
  return (integrationInstance ?? "").trim() || getEvolutionSecrets().instanceName
}

// ---------------------------------------------------------------------------
// Human send (inbox composer)
// ---------------------------------------------------------------------------

export interface SendEvolutionInput {
  clinicId: string
  conversationId: string
  text: string
  sentByUserId: string
  sentByUserName: string
}

export type SendEvolutionResult =
  | { ok: true; messageId: string; deliveryStatus: string; mock: boolean }
  | { ok: false; code: string; httpStatus: number; message: string }

/**
 * Sends a human text reply on an Evolution conversation. Blocks when Evolution
 * isn't allowed here (production), send disabled, or no destination phone. Mock
 * mode records MOCK_SENT without calling the API. Never throws.
 */
export async function sendEvolutionTextForConversation(input: SendEvolutionInput): Promise<SendEvolutionResult> {
  const { clinicId, conversationId, text, sentByUserId, sentByUserName } = input
  const flags = getEvolutionFlags()

  const auditBlocked = (reason: string) =>
    createAuditLog({
      clinicId,
      userId: sentByUserId,
      action: AuditAction.EVOLUTION_MESSAGE_SEND_BLOCKED,
      entity: "Conversation",
      entityId: conversationId,
      description: `Envio Evolution bloqueado (${reason}).`,
      metadata: { conversationId, reason },
    })

  if (!flags.allowedHere) {
    await auditBlocked("evolution_not_allowed_here")
    return { ok: false, code: "not_allowed", httpStatus: 409, message: "Evolution API não está habilitada neste ambiente." }
  }
  if (!flags.sendMessagesEnabled) {
    await auditBlocked("send_disabled")
    return { ok: false, code: "send_disabled", httpStatus: 409, message: "Envio pela Evolution API está desativado." }
  }

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, clinicId },
    select: { id: true, channel: true, status: true, contactPhone: true, externalContactId: true },
  })
  if (!conversation) return { ok: false, code: "not_found", httpStatus: 404, message: "Conversa não encontrada." }
  if (conversation.status === "CLOSED") {
    await auditBlocked("conversation_closed")
    return { ok: false, code: "closed", httpStatus: 409, message: "Reabra a conversa para enviar uma nova mensagem." }
  }

  const toPhone = normalizeWhatsAppPhone(conversation.contactPhone ?? conversation.externalContactId)
  if (!toPhone) {
    await auditBlocked("no_phone")
    return { ok: false, code: "no_phone", httpStatus: 409, message: "Esta conversa não tem um telefone válido para envio." }
  }

  const integration = await prisma.whatsAppIntegration.findUnique({
    where: { clinicId },
    select: { id: true, enabled: true, evolutionInstanceName: true },
  })
  if (!integration?.enabled) {
    await auditBlocked("integration_disabled")
    return { ok: false, code: "integration_disabled", httpStatus: 409, message: "A integração de mensageria da clínica não está habilitada." }
  }
  const instanceName = resolveSendInstance(integration.evolutionInstanceName)
  const secrets = getEvolutionSecrets()
  if (!flags.sendMockMode && (!secrets.apiUrl || !secrets.apiKey || !instanceName)) {
    await auditBlocked("not_configured")
    return { ok: false, code: "not_configured", httpStatus: 409, message: "A Evolution API não está totalmente configurada." }
  }

  const toPhoneMasked = maskPhone(toPhone)
  const shouldAutoAssume = conversation.status === "WAITING_HUMAN" || conversation.status === "AI_HANDLING"
  const message = await prisma.$transaction(async (tx) => {
    if (shouldAutoAssume) {
      await tx.message.create({ data: { clinicId, conversationId, direction: "OUTBOUND", senderType: "SYSTEM", content: `Atendimento assumido por ${sentByUserName}.` } })
    }
    const msg = await tx.message.create({
      data: {
        clinicId,
        conversationId,
        direction: "OUTBOUND",
        senderType: "HUMAN",
        content: text,
        externalChannel: "WHATSAPP",
        deliveryStatus: "PENDING",
        metadata: baseMeta({ userId: sentByUserId, userName: sentByUserName, instanceName, mock: flags.sendMockMode, toPhoneMasked }),
      },
      select: { id: true },
    })
    await tx.conversation.update({ where: { id: conversationId }, data: shouldAutoAssume ? { status: "HUMAN_HANDLING", assignedUserId: sentByUserId } : {} })
    return msg
  })

  await createAuditLog({
    clinicId,
    userId: sentByUserId,
    action: AuditAction.EVOLUTION_MESSAGE_SEND_REQUESTED,
    entity: "Message",
    entityId: message.id,
    description: "Envio de mensagem Evolution solicitado.",
    metadata: { conversationId, messageId: message.id, toPhoneMasked, mock: flags.sendMockMode },
  })

  // Mock mode.
  if (flags.sendMockMode) {
    const externalMessageId = mockEvolutionMessageId()
    await prisma.$transaction([
      prisma.message.update({ where: { id: message.id }, data: { deliveryStatus: "MOCK_SENT", externalMessageId, sentAt: new Date() } }),
      prisma.whatsAppIntegration.update({ where: { id: integration.id }, data: { lastEvolutionMessageSentAt: new Date(), lastMessageSentAt: new Date() } }),
    ])
    await createAuditLog({ clinicId, userId: sentByUserId, action: AuditAction.EVOLUTION_MESSAGE_SENT, entity: "Message", entityId: message.id, description: "Mensagem Evolution registrada (mock).", metadata: { conversationId, messageId: message.id, externalMessageId, deliveryStatus: "MOCK_SENT", mock: true } })
    return { ok: true, messageId: message.id, deliveryStatus: "MOCK_SENT", mock: true }
  }

  // Real send.
  const result = await sendEvolutionTextMessage({ apiUrl: secrets.apiUrl, apiKey: secrets.apiKey, instanceName, toPhone, text, timeoutMs: flags.processingTimeoutMs })
  if (result.ok && result.externalMessageId) {
    await prisma.$transaction([
      prisma.message.update({ where: { id: message.id }, data: { deliveryStatus: "SENT", externalMessageId: result.externalMessageId, sentAt: new Date() } }),
      prisma.whatsAppIntegration.update({ where: { id: integration.id }, data: { lastEvolutionMessageSentAt: new Date(), lastMessageSentAt: new Date() } }),
    ])
    await createAuditLog({ clinicId, userId: sentByUserId, action: AuditAction.EVOLUTION_MESSAGE_SENT, entity: "Message", entityId: message.id, description: "Mensagem Evolution enviada.", metadata: { conversationId, messageId: message.id, externalMessageId: result.externalMessageId, deliveryStatus: "SENT", toPhoneMasked } })
    return { ok: true, messageId: message.id, deliveryStatus: "SENT", mock: false }
  }

  await prisma.message.update({ where: { id: message.id }, data: { deliveryStatus: "FAILED", deliveryErrorCode: result.errorCode ?? "evolution_api_error", deliveryErrorMessage: (result.errorMessage ?? "").slice(0, 300), failedAt: new Date() } })
  await createAuditLog({ clinicId, userId: sentByUserId, action: AuditAction.EVOLUTION_MESSAGE_SEND_FAILED, entity: "Message", entityId: message.id, description: "Falha ao enviar mensagem Evolution.", metadata: { conversationId, messageId: message.id, errorCode: result.errorCode ?? "evolution_api_error", toPhoneMasked } })
  logger.error("Falha ao enviar mensagem Evolution", { context: "evolution.send", metadata: { clinicId, conversationId, errorCode: result.errorCode } })
  return { ok: false, code: "send_failed", httpStatus: 502, message: EVOLUTION_SEND_FRIENDLY_ERROR }
}

// ---------------------------------------------------------------------------
// Assist reply
// ---------------------------------------------------------------------------

export interface EvolutionAssistReplyInput {
  clinicId: string
  conversationId: string
  reply: string
  inboundMessageId: string
  processingRunId: string
  trigger: string
  assistMode: string
  intent?: string
  confidence?: number
}

export interface EvolutionAssistReplyResult {
  messageId: string
  deliveryStatus: "SENT" | "MOCK_SENT" | "INTERNAL_ONLY" | "FAILED"
  sent: boolean
}

/**
 * Sends (or internally saves) a Sinery Assist reply on an Evolution conversation.
 * senderType = AI, no human auto-assume. Honors EVOLUTION_ASSIST_REPLY_ENABLED
 * + EVOLUTION_SEND_MESSAGES_ENABLED (else INTERNAL_ONLY) and mock mode. The AI
 * reply is persisted here as the single OUTBOUND/AI message. Never throws.
 */
export async function sendEvolutionAssistReply(input: EvolutionAssistReplyInput): Promise<EvolutionAssistReplyResult> {
  const flags = getEvolutionFlags()
  const secrets = getEvolutionSecrets()

  const [conversation, integration] = await Promise.all([
    prisma.conversation.findFirst({ where: { id: input.conversationId, clinicId: input.clinicId }, select: { id: true, channel: true, status: true, contactPhone: true, externalContactId: true } }),
    prisma.whatsAppIntegration.findUnique({ where: { clinicId: input.clinicId }, select: { id: true, enabled: true, evolutionInstanceName: true } }),
  ])

  const toPhone = normalizeWhatsAppPhone(conversation?.contactPhone ?? conversation?.externalContactId)
  const instanceName = resolveSendInstance(integration?.evolutionInstanceName ?? null)

  const canReallySend =
    flags.allowedHere &&
    Boolean(conversation) &&
    conversation!.status !== "CLOSED" &&
    Boolean(integration?.enabled) &&
    Boolean(toPhone) &&
    (flags.sendMockMode || (Boolean(secrets.apiUrl) && Boolean(secrets.apiKey) && Boolean(instanceName)))

  // Decide the send target.
  let target: "INTERNAL_ONLY" | "MOCK" | "REAL" = "INTERNAL_ONLY"
  if (canReallySend && flags.assistReplyEnabled && flags.sendMessagesEnabled) {
    target = flags.sendMockMode ? "MOCK" : "REAL"
  }

  const toPhoneMasked = maskPhone(toPhone)
  const message = await prisma.message.create({
    data: {
      clinicId: input.clinicId,
      conversationId: input.conversationId,
      direction: "OUTBOUND",
      senderType: "AI",
      content: input.reply,
      externalChannel: "WHATSAPP",
      deliveryStatus: "PENDING",
      metadata: baseMeta({ trigger: input.trigger, inboundMessageId: input.inboundMessageId, processingRunId: input.processingRunId, assistMode: input.assistMode, intent: input.intent ?? null, confidence: input.confidence ?? null, instanceName, toPhoneMasked }),
    },
    select: { id: true },
  })

  const finish = async (status: EvolutionAssistReplyResult["deliveryStatus"], extra: Record<string, unknown> = {}) => {
    await prisma.message.update({
      where: { id: message.id },
      data: {
        deliveryStatus: status,
        ...(status === "SENT" || status === "MOCK_SENT" ? { sentAt: new Date() } : {}),
        ...(status === "FAILED" ? { failedAt: new Date() } : {}),
        ...(extra.externalMessageId ? { externalMessageId: extra.externalMessageId as string } : {}),
        ...(extra.errorCode ? { deliveryErrorCode: extra.errorCode as string } : {}),
      },
    })
    await prisma.assistProcessingRun.update({ where: { id: input.processingRunId }, data: { outboundMessageId: message.id } }).catch(() => {})
    if (status === "SENT" || status === "MOCK_SENT") {
      await prisma.whatsAppIntegration.update({ where: { clinicId: input.clinicId }, data: { lastEvolutionMessageSentAt: new Date(), lastMessageSentAt: new Date() } }).catch(() => {})
    }
  }

  if (target === "INTERNAL_ONLY") {
    await finish("INTERNAL_ONLY")
    await createAuditLog({ clinicId: input.clinicId, action: AuditAction.WHATSAPP_ASSIST_REPLY_INTERNAL_ONLY, entity: "Message", entityId: message.id, description: "Resposta da Assist gerada internamente — não enviada pela Evolution.", metadata: { conversationId: input.conversationId, messageId: message.id, processingRunId: input.processingRunId } })
    return { messageId: message.id, deliveryStatus: "INTERNAL_ONLY", sent: false }
  }

  if (target === "MOCK") {
    const externalMessageId = mockEvolutionMessageId()
    await finish("MOCK_SENT", { externalMessageId })
    await createAuditLog({ clinicId: input.clinicId, action: AuditAction.EVOLUTION_ASSIST_REPLY_SENT, entity: "Message", entityId: message.id, description: "Resposta da Assist enviada (mock Evolution).", metadata: { conversationId: input.conversationId, messageId: message.id, processingRunId: input.processingRunId, deliveryStatus: "MOCK_SENT", mock: true, toPhoneMasked } })
    return { messageId: message.id, deliveryStatus: "MOCK_SENT", sent: true }
  }

  const result = await sendEvolutionTextMessage({ apiUrl: secrets.apiUrl, apiKey: secrets.apiKey, instanceName, toPhone, text: input.reply, timeoutMs: flags.processingTimeoutMs })
  if (result.ok && result.externalMessageId) {
    await finish("SENT", { externalMessageId: result.externalMessageId })
    await createAuditLog({ clinicId: input.clinicId, action: AuditAction.EVOLUTION_ASSIST_REPLY_SENT, entity: "Message", entityId: message.id, description: "Resposta da Assist enviada pela Evolution.", metadata: { conversationId: input.conversationId, messageId: message.id, processingRunId: input.processingRunId, externalMessageId: result.externalMessageId, deliveryStatus: "SENT", toPhoneMasked } })
    return { messageId: message.id, deliveryStatus: "SENT", sent: true }
  }

  await finish("FAILED", { errorCode: result.errorCode ?? "evolution_api_error" })
  await createAuditLog({ clinicId: input.clinicId, action: AuditAction.EVOLUTION_ASSIST_REPLY_FAILED, entity: "Message", entityId: message.id, description: "Falha ao enviar a resposta da Assist pela Evolution.", metadata: { conversationId: input.conversationId, messageId: message.id, processingRunId: input.processingRunId, errorCode: result.errorCode ?? "evolution_api_error", toPhoneMasked } })
  return { messageId: message.id, deliveryStatus: "FAILED", sent: false }
}
