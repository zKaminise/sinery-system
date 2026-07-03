import "server-only"

import { createHash } from "node:crypto"

import { prisma } from "@/lib/prisma"
import { Prisma } from "@/lib/generated/prisma/client"
import { logger } from "@/lib/logger"
import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"
import { getWhatsAppWebhookFlags, getEnvPhoneNumberId } from "@/lib/whatsapp/whatsapp-config"
import { normalizeWhatsAppPhone, phonesMatch, maskPhone } from "@/lib/whatsapp/whatsapp-phone"
import { applyDeliveryStatus, mapWebhookStatus, type DeliveryStatus } from "@/lib/whatsapp/whatsapp-delivery-status"
import { parseWhatsAppWebhookPayload } from "@/lib/whatsapp/whatsapp-webhook-parser"
import type {
  NormalizedWhatsAppEvent,
  NormalizedMessageEvent,
  NormalizedStatusEvent,
} from "@/lib/whatsapp/whatsapp-webhook-types"

export interface WebhookProcessResult {
  received: number
  processed: number
  duplicates: number
  ignored: number
}

/** Stable per-event hash → idempotency key (Meta re-delivers events). */
function hashEvent(event: NormalizedWhatsAppEvent): string {
  const key =
    event.kind === "message"
      ? `msg:${event.phoneNumberId}:${event.whatsappMessageId}`
      : `st:${event.phoneNumberId}:${event.statusId ?? event.whatsappMessageId ?? ""}:${event.status}:${event.timestamp?.getTime() ?? ""}`
  return createHash("sha256").update(key).digest("hex")
}

/** Resolves the integration/clinic for a phoneNumberId. Requires enabled. */
async function resolveIntegration(phoneNumberId: string) {
  let integration = await prisma.whatsAppIntegration.findFirst({
    where: { phoneNumberId, enabled: true },
    select: { id: true, clinicId: true, enabled: true, webhookEnabled: true },
  })

  // Documented DEV fallback: if the env phoneNumberId matches and there's
  // exactly one integration, use it (lets local testing work before a config
  // check has synced phoneNumberId into the row). Never used in prod-like data
  // with multiple clinics.
  if (!integration && getEnvPhoneNumberId() && getEnvPhoneNumberId() === phoneNumberId) {
    const all = await prisma.whatsAppIntegration.findMany({ where: { enabled: true }, select: { id: true, clinicId: true, enabled: true, webhookEnabled: true } })
    if (all.length === 1) integration = all[0]
  }

  return integration
}

/** Records the webhook event row; returns null if it's a duplicate (payloadHash). */
async function recordEvent(input: {
  clinicId: string | null
  integrationId: string | null
  eventType: string
  whatsappMessageId?: string
  whatsappStatusId?: string
  phoneNumberId: string
  fromPhone?: string
  payloadHash: string
}): Promise<{ id: string } | null> {
  const existing = await prisma.whatsAppWebhookEvent.findUnique({
    where: { payloadHash: input.payloadHash },
    select: { id: true },
  })
  if (existing) return null
  try {
    return await prisma.whatsAppWebhookEvent.create({
      data: {
        clinicId: input.clinicId,
        integrationId: input.integrationId,
        eventType: input.eventType,
        whatsappMessageId: input.whatsappMessageId ?? null,
        whatsappStatusId: input.whatsappStatusId ?? null,
        phoneNumberId: input.phoneNumberId,
        fromPhone: input.fromPhone ?? null,
        payloadHash: input.payloadHash,
      },
      select: { id: true },
    })
  } catch {
    // Unique race → treat as duplicate.
    return null
  }
}

/** Finds a clinic patient by phone. Unique match → id; ambiguous/none → null. */
async function findPatientByPhoneForWhatsApp(
  clinicId: string,
  fromPhone: string
): Promise<{ status: "unique" | "ambiguous" | "none"; patientId?: string }> {
  const patients = await prisma.patient.findMany({
    where: { clinicId },
    select: { id: true, phone: true },
  })
  const matches = patients.filter((p) => phonesMatch(p.phone, fromPhone))
  if (matches.length === 1) return { status: "unique", patientId: matches[0].id }
  if (matches.length > 1) return { status: "ambiguous" }
  return { status: "none" }
}

async function processMessageEvent(event: NormalizedMessageEvent): Promise<"processed" | "duplicate" | "ignored"> {
  const integration = await resolveIntegration(event.phoneNumberId)
  const payloadHash = hashEvent(event)

  if (!integration) {
    // Unknown phone number id → record without clinic, ignore, log (no audit).
    await recordEvent({
      clinicId: null,
      integrationId: null,
      eventType: "message",
      whatsappMessageId: event.whatsappMessageId,
      phoneNumberId: event.phoneNumberId,
      fromPhone: normalizeWhatsAppPhone(event.fromPhone),
      payloadHash,
    })
    logger.warn("Webhook WhatsApp de phoneNumberId desconhecido", {
      context: "whatsapp.webhook",
      metadata: { phoneNumberId: event.phoneNumberId },
    })
    return "ignored"
  }

  const clinicId = integration.clinicId

  // Idempotency (event level).
  const eventRow = await recordEvent({
    clinicId,
    integrationId: integration.id,
    eventType: "message",
    whatsappMessageId: event.whatsappMessageId,
    phoneNumberId: event.phoneNumberId,
    fromPhone: normalizeWhatsAppPhone(event.fromPhone),
    payloadHash,
  })
  if (!eventRow) {
    await createAuditLog({
      clinicId,
      action: AuditAction.WHATSAPP_MESSAGE_DUPLICATE_IGNORED,
      entity: "WhatsAppWebhookEvent",
      description: "Mensagem WhatsApp duplicada ignorada (idempotência).",
      metadata: { whatsappMessageId: event.whatsappMessageId, phoneNumberId: event.phoneNumberId },
    })
    return "duplicate"
  }

  // Idempotency (message level) — same wamid already stored as a Message.
  const existingMessage = await prisma.message.findFirst({
    where: { clinicId, externalMessageId: event.whatsappMessageId },
    select: { id: true },
  })
  if (existingMessage) {
    await prisma.whatsAppWebhookEvent.update({ where: { id: eventRow.id }, data: { ignored: true, processedAt: new Date() } })
    await createAuditLog({
      clinicId,
      action: AuditAction.WHATSAPP_MESSAGE_DUPLICATE_IGNORED,
      entity: "Message",
      description: "Mensagem WhatsApp duplicada ignorada (wamid já existe).",
      metadata: { whatsappMessageId: event.whatsappMessageId },
    })
    return "duplicate"
  }

  const normalizedFrom = normalizeWhatsAppPhone(event.fromPhone)

  // Patient association by phone.
  const patientMatch = await findPatientByPhoneForWhatsApp(clinicId, event.fromPhone)
  const patientId = patientMatch.status === "unique" ? patientMatch.patientId! : null
  if (patientMatch.status === "unique") {
    await createAuditLog({
      clinicId,
      action: AuditAction.PATIENT_MATCHED_FROM_WHATSAPP,
      entity: "Patient",
      entityId: patientId!,
      description: "Paciente associado à conversa WhatsApp por telefone.",
      metadata: { phone: maskPhone(event.fromPhone) },
    })
  } else if (patientMatch.status === "ambiguous") {
    await createAuditLog({
      clinicId,
      action: AuditAction.PATIENT_MATCH_AMBIGUOUS_FROM_WHATSAPP,
      entity: "Patient",
      description: "Múltiplos pacientes com telefone semelhante — não associado automaticamente.",
      metadata: { phone: maskPhone(event.fromPhone) },
    })
  }

  // Find an existing open WhatsApp conversation for this contact.
  const openConversation = await prisma.conversation.findFirst({
    where: { clinicId, channel: "WHATSAPP", externalContactId: normalizedFrom, status: { not: "CLOSED" } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, patientId: true },
  })

  let conversationId: string
  let reopened = false
  let created = false

  if (openConversation) {
    conversationId = openConversation.id
    // Backfill patient if we now matched one and it was empty.
    if (patientId && !openConversation.patientId) {
      await prisma.conversation.update({ where: { id: conversationId }, data: { patientId } })
    }
  } else {
    // Reopen the most recent CLOSED conversation, or create a new one.
    const closed = await prisma.conversation.findFirst({
      where: { clinicId, channel: "WHATSAPP", externalContactId: normalizedFrom, status: "CLOSED" },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    })
    if (closed) {
      conversationId = closed.id
      reopened = true
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { status: "WAITING_HUMAN", ...(patientId ? { patientId } : {}) },
      })
      await prisma.message.create({
        data: {
          clinicId,
          conversationId,
          direction: "OUTBOUND",
          senderType: "SYSTEM",
          content: "Conversa reaberta por nova mensagem recebida via WhatsApp.",
        },
      })
    } else {
      created = true
      // WAITING_HUMAN: no real send this prompt, so a human should handle it.
      const conv = await prisma.conversation.create({
        data: {
          clinicId,
          patientId,
          channel: "WHATSAPP",
          externalContactId: normalizedFrom,
          contactName: event.contactName ?? null,
          contactPhone: normalizedFrom,
          status: "WAITING_HUMAN",
        },
        select: { id: true },
      })
      conversationId = conv.id
    }
  }

  // The inbound message.
  await prisma.message.create({
    data: {
      clinicId,
      conversationId,
      direction: "INBOUND",
      senderType: "PATIENT",
      content: event.text || "[Mensagem vazia]",
      externalMessageId: event.whatsappMessageId,
      externalChannel: "WHATSAPP",
      externalTimestamp: event.timestamp,
      metadata: {
        source: "WHATSAPP_CLOUD_API",
        whatsappMessageId: event.whatsappMessageId,
        messageType: event.messageType,
        fromPhone: normalizedFrom,
        contactName: event.contactName ?? null,
        phoneNumberId: event.phoneNumberId,
        receivedAt: event.timestamp.toISOString(),
        ...(event.rawTypeMetadata ? { typeMetadata: event.rawTypeMetadata } : {}),
      } as Prisma.InputJsonValue,
    },
  })

  await Promise.all([
    prisma.whatsAppIntegration.update({ where: { id: integration.id }, data: { lastMessageReceivedAt: new Date() } }),
    prisma.whatsAppWebhookEvent.update({ where: { id: eventRow.id }, data: { processed: true, processedAt: new Date() } }),
  ])

  if (created) {
    await createAuditLog({
      clinicId,
      action: AuditAction.CONVERSATION_CREATED_FROM_WHATSAPP,
      entity: "Conversation",
      entityId: conversationId,
      description: "Conversa criada a partir de mensagem recebida no WhatsApp.",
      metadata: { phone: maskPhone(event.fromPhone), hasPatient: Boolean(patientId) },
    })
  } else if (reopened) {
    await createAuditLog({
      clinicId,
      action: AuditAction.CONVERSATION_REOPENED_FROM_WHATSAPP,
      entity: "Conversation",
      entityId: conversationId,
      description: "Conversa reaberta por nova mensagem recebida no WhatsApp.",
      metadata: { phone: maskPhone(event.fromPhone) },
    })
  }

  await createAuditLog({
    clinicId,
    action: AuditAction.WHATSAPP_MESSAGE_RECEIVED,
    entity: "Conversation",
    entityId: conversationId,
    description: "Mensagem recebida via WhatsApp.",
    metadata: {
      whatsappMessageId: event.whatsappMessageId,
      messageType: event.messageType,
      phone: maskPhone(event.fromPhone),
    },
  })

  return "processed"
}

async function processStatusEvent(event: NormalizedStatusEvent): Promise<"processed" | "duplicate" | "ignored"> {
  const integration = await resolveIntegration(event.phoneNumberId)
  const payloadHash = hashEvent(event)
  const clinicId = integration?.clinicId ?? null

  const eventRow = await recordEvent({
    clinicId,
    integrationId: integration?.id ?? null,
    eventType: "status",
    whatsappStatusId: event.statusId,
    whatsappMessageId: event.whatsappMessageId,
    phoneNumberId: event.phoneNumberId,
    payloadHash,
  })
  if (!eventRow) return "duplicate"

  await prisma.whatsAppWebhookEvent.update({ where: { id: eventRow.id }, data: { processed: true, processedAt: new Date() } })

  if (clinicId) {
    await createAuditLog({
      clinicId,
      action: AuditAction.WHATSAPP_STATUS_RECEIVED,
      entity: "WhatsAppWebhookEvent",
      entityId: eventRow.id,
      description: `Status recebido via WhatsApp: ${event.status}.`,
      metadata: { status: event.status, whatsappMessageId: event.whatsappMessageId },
    })
    if (event.status === "failed") {
      await createAuditLog({
        clinicId,
        action: AuditAction.WHATSAPP_STATUS_FAILED_RECEIVED,
        entity: "WhatsAppWebhookEvent",
        entityId: eventRow.id,
        description: "Status de falha recebido via WhatsApp.",
        metadata: { status: event.status, errorCount: event.errors?.length ?? 0 },
      })
    }

    // Apply the status to the matching OUTBOUND message (Prompt 18). Status
    // never regresses; a status for an unknown message is ignored safely.
    await applyStatusToOutboundMessage(clinicId, event)
  } else {
    logger.warn("Status WhatsApp de phoneNumberId desconhecido", {
      context: "whatsapp.webhook",
      metadata: { phoneNumberId: event.phoneNumberId, status: event.status },
    })
    return "ignored"
  }

  return "processed"
}

/** Advances an outbound Message's deliveryStatus from a webhook status event. */
async function applyStatusToOutboundMessage(clinicId: string, event: NormalizedStatusEvent): Promise<void> {
  if (!event.whatsappMessageId) return
  const mapped = mapWebhookStatus(event.status)
  if (!mapped) return

  const message = await prisma.message.findFirst({
    where: { clinicId, externalMessageId: event.whatsappMessageId, externalChannel: "WHATSAPP", direction: "OUTBOUND" },
    select: { id: true, deliveryStatus: true },
  })
  if (!message) return // status for an unknown/other message — ignore safely.

  const next = applyDeliveryStatus(message.deliveryStatus as DeliveryStatus | null, mapped)
  if (!next) return // no regression / no change.

  const now = new Date()
  const timestampField =
    next === "SENT" ? { sentAt: now } : next === "DELIVERED" ? { deliveredAt: now } : next === "READ" ? { readAt: now } : { failedAt: now }
  const errorFields =
    next === "FAILED"
      ? {
          deliveryErrorCode: event.errors?.[0]?.code ?? "delivery_failed",
          deliveryErrorMessage: (event.errors?.[0]?.message ?? event.errors?.[0]?.title ?? "").slice(0, 300),
        }
      : {}

  await prisma.message.update({
    where: { id: message.id },
    data: { deliveryStatus: next, ...timestampField, ...errorFields },
  })

  await createAuditLog({
    clinicId,
    action: next === "FAILED" ? AuditAction.WHATSAPP_MESSAGE_DELIVERY_FAILED : AuditAction.WHATSAPP_MESSAGE_STATUS_UPDATED,
    entity: "Message",
    entityId: message.id,
    description: `Status de entrega atualizado para ${next}.`,
    metadata: { messageId: message.id, deliveryStatus: next, whatsappMessageId: event.whatsappMessageId },
  })
}

/**
 * Processes an already-verified (signature-checked) WhatsApp webhook body.
 * NEVER sends a message / calls the Graph API. Idempotent per event. Returns a
 * summary; the route always responds 200.
 */
export async function processWhatsAppWebhook(payload: unknown): Promise<WebhookProcessResult> {
  const { events } = parseWhatsAppWebhookPayload(payload)
  const result: WebhookProcessResult = { received: events.length, processed: 0, duplicates: 0, ignored: 0 }

  for (const event of events) {
    try {
      const outcome = event.kind === "message" ? await processMessageEvent(event) : await processStatusEvent(event)
      if (outcome === "processed") result.processed += 1
      else if (outcome === "duplicate") result.duplicates += 1
      else result.ignored += 1
    } catch (error) {
      result.ignored += 1
      logger.error("Falha ao processar evento de webhook WhatsApp", {
        context: "whatsapp.webhook",
        error,
        metadata: { kind: event.kind, phoneNumberId: event.phoneNumberId },
      })
    }
  }

  return result
}

/** Whether the webhook is enabled + safe env flags (route + UI use it). */
export function getWebhookRuntimeFlags() {
  return getWhatsAppWebhookFlags()
}
