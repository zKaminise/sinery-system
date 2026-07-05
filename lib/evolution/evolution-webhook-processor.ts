import "server-only"

import { prisma } from "@/lib/prisma"
import { Prisma } from "@/lib/generated/prisma/client"
import { logger } from "@/lib/logger"
import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"
import { maskPhone, phonesMatch } from "@/lib/whatsapp/whatsapp-phone"
import { getAiConfig } from "@/lib/ai/config"
import { getEvolutionFlags } from "@/lib/evolution/evolution-config"
import { parseEvolutionWebhook } from "@/lib/evolution/evolution-webhook-parser"
import { resolveClinicByEvolutionInstance, type ResolvedEvolutionIntegration } from "@/lib/evolution/evolution-instance-resolver"
import { processEvolutionInboundWithAssist } from "@/lib/evolution/evolution-assist-processor"
import { normalizeEvolutionMessage } from "@/lib/messaging/messaging-normalizer"
import { buildMessagingEventHash } from "@/lib/messaging/messaging-idempotency"
import { recordMessagingEvent, markMessagingEventProcessed } from "@/lib/messaging/messaging-webhook-events"
import type { NormalizedInboundMessage } from "@/lib/messaging/messaging-types"
import type { EvolutionRawMessage } from "@/lib/evolution/evolution-types"

export interface EvolutionWebhookResult {
  received: number
  processed: number
  duplicates: number
  ignored: number
}

async function findPatientByPhone(clinicId: string, fromPhone: string): Promise<string | null> {
  const patients = await prisma.patient.findMany({ where: { clinicId }, select: { id: true, phone: true } })
  const matches = patients.filter((p) => phonesMatch(p.phone, fromPhone))
  return matches.length === 1 ? matches[0].id : null
}

async function processOne(raw: EvolutionRawMessage, instanceName: string | null, integration: ResolvedEvolutionIntegration | null): Promise<"processed" | "duplicate" | "ignored"> {
  const normalized: NormalizedInboundMessage = normalizeEvolutionMessage(raw, instanceName)
  const payloadHash = buildMessagingEventHash({ provider: "EVOLUTION_API", instanceName, externalMessageId: normalized.externalMessageId, fromPhone: normalized.fromPhone })

  if (!integration) {
    await recordMessagingEvent({ clinicId: null, provider: "EVOLUTION_API", eventType: "message", externalMessageId: normalized.externalMessageId, instanceName, fromPhone: normalized.fromPhone, payloadHash })
    logger.warn("Webhook Evolution de instanceName desconhecido", { context: "evolution.webhook", metadata: { instanceName } })
    return "ignored"
  }

  const clinicId = integration.clinicId

  const eventRow = await recordMessagingEvent({ clinicId, provider: "EVOLUTION_API", eventType: "message", externalMessageId: normalized.externalMessageId, instanceName, fromPhone: normalized.fromPhone, payloadHash })
  if (!eventRow) {
    await createAuditLog({ clinicId, action: AuditAction.EVOLUTION_MESSAGE_DUPLICATE_IGNORED, entity: "MessagingWebhookEvent", description: "Mensagem Evolution duplicada ignorada (idempotência).", metadata: { externalMessageId: normalized.externalMessageId, instanceName } })
    return "duplicate"
  }

  // Message-level idempotency.
  const existingMessage = await prisma.message.findFirst({ where: { clinicId, externalMessageId: normalized.externalMessageId }, select: { id: true } })
  if (existingMessage) {
    await markMessagingEventProcessed(eventRow.id, { ignored: true })
    await createAuditLog({ clinicId, action: AuditAction.EVOLUTION_MESSAGE_DUPLICATE_IGNORED, entity: "Message", description: "Mensagem Evolution duplicada ignorada (id externo já existe).", metadata: { externalMessageId: normalized.externalMessageId } })
    return "duplicate"
  }

  const patientId = await findPatientByPhone(clinicId, normalized.fromPhone)

  const aiSettings = await prisma.aiSettings.findUnique({ where: { clinicId }, select: { enabled: true } })
  const flags = getEvolutionFlags()
  const autoOn = flags.autoProcessAssist && flags.allowedHere && !getAiConfig().globalDisabled && Boolean(integration.enabled) && Boolean(aiSettings?.enabled)
  const initialStatus = autoOn ? "AI_HANDLING" : "WAITING_HUMAN"

  const openConversation = await prisma.conversation.findFirst({
    where: { clinicId, channel: "WHATSAPP", externalContactId: normalized.fromPhone, status: { not: "CLOSED" } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, patientId: true, status: true },
  })

  let conversationId: string
  let effectiveStatus: string = openConversation?.status ?? initialStatus
  let created = false

  if (openConversation) {
    conversationId = openConversation.id
    if (patientId && !openConversation.patientId) await prisma.conversation.update({ where: { id: conversationId }, data: { patientId } })
  } else {
    const closed = await prisma.conversation.findFirst({ where: { clinicId, channel: "WHATSAPP", externalContactId: normalized.fromPhone, status: "CLOSED" }, orderBy: { updatedAt: "desc" }, select: { id: true } })
    if (closed) {
      conversationId = closed.id
      effectiveStatus = initialStatus
      await prisma.conversation.update({ where: { id: conversationId }, data: { status: initialStatus, ...(patientId ? { patientId } : {}) } })
      await prisma.message.create({ data: { clinicId, conversationId, direction: "OUTBOUND", senderType: "SYSTEM", content: "Conversa reaberta por nova mensagem recebida via Evolution." } })
    } else {
      created = true
      effectiveStatus = initialStatus
      const conv = await prisma.conversation.create({
        data: { clinicId, patientId, channel: "WHATSAPP", externalContactId: normalized.fromPhone, contactName: normalized.contactName ?? null, contactPhone: normalized.fromPhone, status: initialStatus },
        select: { id: true },
      })
      conversationId = conv.id
    }
  }

  const inboundMessage = await prisma.message.create({
    data: {
      clinicId,
      conversationId,
      direction: "INBOUND",
      senderType: "PATIENT",
      content: normalized.text || "[Mensagem vazia]",
      externalMessageId: normalized.externalMessageId,
      externalChannel: "WHATSAPP",
      externalTimestamp: normalized.timestamp,
      metadata: {
        source: "EVOLUTION_API",
        provider: "EVOLUTION_API",
        instanceName,
        remoteJid: normalized.externalConversationId ?? null,
        pushName: normalized.contactName ?? null,
        messageType: normalized.messageType,
        fromPhone: normalized.fromPhone,
        receivedAt: normalized.timestamp.toISOString(),
      } as Prisma.InputJsonValue,
    },
    select: { id: true },
  })

  await Promise.all([
    prisma.whatsAppIntegration.update({ where: { id: integration.id }, data: { lastEvolutionMessageReceivedAt: new Date(), lastMessageReceivedAt: new Date() } }),
    markMessagingEventProcessed(eventRow.id),
  ])

  if (created) {
    await createAuditLog({ clinicId, action: AuditAction.CONVERSATION_CREATED_FROM_WHATSAPP, entity: "Conversation", entityId: conversationId, description: "Conversa criada a partir de mensagem recebida via Evolution.", metadata: { phone: maskPhone(normalized.fromPhone), provider: "EVOLUTION_API", hasPatient: Boolean(patientId) } })
  }
  await createAuditLog({ clinicId, action: AuditAction.EVOLUTION_MESSAGE_RECEIVED, entity: "Conversation", entityId: conversationId, description: "Mensagem recebida via Evolution.", metadata: { externalMessageId: normalized.externalMessageId, messageType: normalized.messageType, phone: maskPhone(normalized.fromPhone), instanceName } })

  if (autoOn && effectiveStatus === "AI_HANDLING") {
    try {
      await Promise.race([
        processEvolutionInboundWithAssist({ clinicId, conversationId, inboundMessageId: inboundMessage.id, trigger: "WEBHOOK_AUTO" }),
        new Promise((resolve) => setTimeout(resolve, flags.processingTimeoutMs)),
      ])
    } catch (error) {
      logger.error("Falha no auto-processamento da Assist (Evolution)", { context: "evolution.assist", error, metadata: { clinicId, conversationId } })
    }
  }

  return "processed"
}

/**
 * Processes an already-authorized Evolution webhook body. Idempotent per message.
 * NEVER trusts a clinicId from the body — resolves the clinic by instanceName.
 * Always safe to call; returns a summary (the route always responds 200).
 */
export async function processEvolutionWebhook(payload: unknown): Promise<EvolutionWebhookResult> {
  const parsed = parseEvolutionWebhook(payload)
  const result: EvolutionWebhookResult = { received: parsed.messages.length, processed: 0, duplicates: 0, ignored: 0 }

  const integration = parsed.instanceName ? await resolveClinicByEvolutionInstance(parsed.instanceName) : null

  if (parsed.messages.length === 0) {
    if (integration) {
      await createAuditLog({ clinicId: integration.clinicId, action: AuditAction.EVOLUTION_WEBHOOK_EVENT_IGNORED, entity: "WhatsAppIntegration", description: "Evento do webhook Evolution ignorado.", metadata: { reason: parsed.ignoredReason ?? "no_messages", event: parsed.rawEvent, instanceName: parsed.instanceName, droppedFromMe: parsed.droppedFromMe, droppedGroup: parsed.droppedGroup } })
    }
    result.ignored = 1
    return result
  }

  for (const raw of parsed.messages) {
    try {
      const outcome = await processOne(raw, parsed.instanceName, integration)
      if (outcome === "processed") result.processed += 1
      else if (outcome === "duplicate") result.duplicates += 1
      else result.ignored += 1
    } catch (error) {
      result.ignored += 1
      logger.error("Falha ao processar mensagem de webhook Evolution", { context: "evolution.webhook", error, metadata: { instanceName: parsed.instanceName } })
    }
  }

  return result
}
