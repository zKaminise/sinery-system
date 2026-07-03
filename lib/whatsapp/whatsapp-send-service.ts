import "server-only"

import { prisma } from "@/lib/prisma"
import { Prisma } from "@/lib/generated/prisma/client"
import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"
import { logger } from "@/lib/logger"
import { getWhatsAppSendFlags } from "@/lib/whatsapp/whatsapp-config"
import { maskPhone, normalizeWhatsAppPhone } from "@/lib/whatsapp/whatsapp-phone"
import { getLastInboundWhatsAppMessageAt } from "@/lib/whatsapp/whatsapp-service-window"
import { isWithinWhatsAppServiceWindow, WHATSAPP_SERVICE_WINDOW_EXPIRED_MESSAGE } from "@/lib/whatsapp/whatsapp-window"
import { sendWhatsAppText } from "@/lib/whatsapp/whatsapp-send-client"
import { WHATSAPP_SEND_FRIENDLY_ERROR } from "@/lib/whatsapp/whatsapp-send-response"

export interface SendWhatsAppInput {
  clinicId: string
  conversationId: string
  text: string
  sentByUserId: string
  sentByUserName: string
}

export type SendWhatsAppResult =
  | { ok: true; messageId: string; deliveryStatus: string; mock: boolean }
  | {
      ok: false
      code:
        | "not_found"
        | "not_whatsapp"
        | "closed"
        | "no_phone"
        | "integration_disabled"
        | "send_disabled"
        | "no_token"
        | "service_window"
        | "send_failed"
      httpStatus: number
      message: string
    }

function mockWamid(): string {
  return `mock_wamid_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Sends a real (or mocked) WhatsApp text reply for a conversation. Enforces:
 * channel WHATSAPP, not CLOSED, integration enabled + phoneNumberId, env send
 * enabled, token present (real mode), and the 24h service window. Creates the
 * OUTBOUND/HUMAN Message (PENDING → SENT/MOCK_SENT/FAILED), persists the
 * returned externalMessageId, updates lastMessageSentAt, and audits. The
 * destination phone comes from the Conversation (never the frontend).
 */
export async function sendWhatsAppTextMessage(input: SendWhatsAppInput): Promise<SendWhatsAppResult> {
  const { clinicId, conversationId, text, sentByUserId, sentByUserName } = input
  const flags = getWhatsAppSendFlags()

  const auditBlocked = (reason: string, extra: Record<string, unknown> = {}) =>
    createAuditLog({
      clinicId,
      userId: sentByUserId,
      action: AuditAction.WHATSAPP_MESSAGE_SEND_BLOCKED,
      entity: "Conversation",
      entityId: conversationId,
      description: `Envio WhatsApp bloqueado (${reason}).`,
      metadata: { conversationId, reason, ...extra },
    })

  if (!flags.sendMessagesEnabled) {
    await auditBlocked("send_disabled")
    return { ok: false, code: "send_disabled", httpStatus: 409, message: "Envio real pelo WhatsApp está desativado nas configurações." }
  }

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, clinicId },
    select: { id: true, channel: true, status: true, contactPhone: true, externalContactId: true },
  })
  if (!conversation) return { ok: false, code: "not_found", httpStatus: 404, message: "Conversa não encontrada." }
  if (conversation.channel !== "WHATSAPP") {
    return { ok: false, code: "not_whatsapp", httpStatus: 400, message: "Conversa não é WhatsApp." }
  }
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
    select: { id: true, enabled: true, phoneNumberId: true },
  })
  if (!integration || !integration.enabled || !integration.phoneNumberId) {
    await auditBlocked("integration_disabled")
    return { ok: false, code: "integration_disabled", httpStatus: 409, message: "A integração WhatsApp da clínica não está habilitada." }
  }
  if (!flags.sendMockMode && !flags.hasAccessToken) {
    await auditBlocked("no_token")
    return { ok: false, code: "no_token", httpStatus: 409, message: "O token de acesso do WhatsApp não está configurado." }
  }

  // 24h service window.
  const lastInboundAt = await getLastInboundWhatsAppMessageAt(clinicId, conversationId)
  if (!isWithinWhatsAppServiceWindow(lastInboundAt, new Date(), flags.require24hWindow)) {
    await createAuditLog({
      clinicId,
      userId: sentByUserId,
      action: AuditAction.WHATSAPP_SERVICE_WINDOW_EXPIRED,
      entity: "Conversation",
      entityId: conversationId,
      description: "Janela de atendimento de 24h expirada — envio bloqueado.",
      metadata: { conversationId },
    })
    await auditBlocked("service_window")
    return { ok: false, code: "service_window", httpStatus: 409, message: WHATSAPP_SERVICE_WINDOW_EXPIRED_MESSAGE }
  }

  const toPhoneMasked = maskPhone(toPhone)
  const baseMetadata = {
    userId: sentByUserId,
    userName: sentByUserName,
    source: "WHATSAPP_CLOUD_API",
    provider: "META",
    mock: flags.sendMockMode,
    toPhoneMasked,
    graphApiVersion: flags.graphApiVersion,
  }

  // Create the PENDING outbound message (+ auto-assume the conversation).
  const shouldAutoAssume = conversation.status === "WAITING_HUMAN" || conversation.status === "AI_HANDLING"
  const message = await prisma.$transaction(async (tx) => {
    if (shouldAutoAssume) {
      await tx.message.create({
        data: { clinicId, conversationId, direction: "OUTBOUND", senderType: "SYSTEM", content: `Atendimento assumido por ${sentByUserName}.` },
      })
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
        metadata: baseMetadata as Prisma.InputJsonValue,
      },
      select: { id: true },
    })
    await tx.conversation.update({
      where: { id: conversationId },
      data: shouldAutoAssume ? { status: "HUMAN_HANDLING", assignedUserId: sentByUserId } : {},
    })
    return msg
  })

  await createAuditLog({
    clinicId,
    userId: sentByUserId,
    action: AuditAction.WHATSAPP_MESSAGE_SEND_REQUESTED,
    entity: "Message",
    entityId: message.id,
    description: "Envio de mensagem WhatsApp solicitado.",
    metadata: { conversationId, messageId: message.id, toPhoneMasked, mock: flags.sendMockMode },
  })

  // ---- MOCK MODE: no Graph API call ----
  if (flags.sendMockMode) {
    const externalMessageId = mockWamid()
    await prisma.$transaction([
      prisma.message.update({
        where: { id: message.id },
        data: { deliveryStatus: "MOCK_SENT", externalMessageId, sentAt: new Date(), metadata: { ...baseMetadata, mock: true } as Prisma.InputJsonValue },
      }),
      prisma.whatsAppIntegration.update({ where: { id: integration.id }, data: { lastMessageSentAt: new Date() } }),
    ])
    await createAuditLog({
      clinicId,
      userId: sentByUserId,
      action: AuditAction.WHATSAPP_SEND_MOCKED,
      entity: "Message",
      entityId: message.id,
      description: "Envio WhatsApp simulado (mock) — não enviado à Meta.",
      metadata: { conversationId, messageId: message.id, externalMessageId, toPhoneMasked, mock: true },
    })
    await createAuditLog({
      clinicId,
      userId: sentByUserId,
      action: AuditAction.WHATSAPP_MESSAGE_SENT,
      entity: "Message",
      entityId: message.id,
      description: "Mensagem WhatsApp registrada (mock).",
      metadata: { conversationId, messageId: message.id, externalMessageId, deliveryStatus: "MOCK_SENT", mock: true },
    })
    return { ok: true, messageId: message.id, deliveryStatus: "MOCK_SENT", mock: true }
  }

  // ---- REAL MODE: call the Graph API ----
  const result = await sendWhatsAppText({
    phoneNumberId: integration.phoneNumberId,
    toPhone,
    text,
    timeoutMs: flags.sendTimeoutMs,
  })

  if (result.ok && result.whatsappMessageId) {
    await prisma.$transaction([
      prisma.message.update({
        where: { id: message.id },
        data: { deliveryStatus: "SENT", externalMessageId: result.whatsappMessageId, sentAt: new Date() },
      }),
      prisma.whatsAppIntegration.update({ where: { id: integration.id }, data: { lastMessageSentAt: new Date() } }),
    ])
    await createAuditLog({
      clinicId,
      userId: sentByUserId,
      action: AuditAction.WHATSAPP_MESSAGE_SENT,
      entity: "Message",
      entityId: message.id,
      description: "Mensagem WhatsApp enviada.",
      metadata: { conversationId, messageId: message.id, externalMessageId: result.whatsappMessageId, deliveryStatus: "SENT", toPhoneMasked },
    })
    return { ok: true, messageId: message.id, deliveryStatus: "SENT", mock: false }
  }

  // Failure — mark FAILED (sanitized) and audit.
  await prisma.message.update({
    where: { id: message.id },
    data: {
      deliveryStatus: "FAILED",
      deliveryErrorCode: result.errorCode ?? "graph_api_error",
      deliveryErrorMessage: (result.errorMessage ?? "").slice(0, 300),
      failedAt: new Date(),
    },
  })
  await createAuditLog({
    clinicId,
    userId: sentByUserId,
    action: AuditAction.WHATSAPP_MESSAGE_SEND_FAILED,
    entity: "Message",
    entityId: message.id,
    description: "Falha ao enviar mensagem WhatsApp.",
    metadata: { conversationId, messageId: message.id, errorCode: result.errorCode ?? "graph_api_error", toPhoneMasked },
  })
  logger.error("Falha ao enviar mensagem WhatsApp", {
    context: "whatsapp.send",
    metadata: { clinicId, conversationId, errorCode: result.errorCode },
  })
  return { ok: false, code: "send_failed", httpStatus: 502, message: WHATSAPP_SEND_FRIENDLY_ERROR }
}
