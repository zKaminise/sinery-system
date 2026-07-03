import "server-only"

import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"
import {
  getWhatsAppRuntimeConfig,
  getWhatsAppEnvIds,
  validateWhatsAppEnv,
  getWhatsAppWebhookFlags,
  getWhatsAppSendFlags,
} from "@/lib/whatsapp/whatsapp-config"
import { statusMessage, type WhatsAppSafeConfig, type WhatsAppIntegrationStatus } from "@/lib/whatsapp/whatsapp-validate"
import { maskWhatsAppId } from "@/lib/whatsapp/whatsapp-mask"
import { updateWhatsAppIntegrationSchema, type UpdateWhatsAppIntegrationInput } from "@/lib/whatsapp/whatsapp-schemas"

export interface WhatsAppIntegrationView {
  id: string
  enabled: boolean
  provider: string
  status: WhatsAppIntegrationStatus
  displayPhoneNumber: string | null
  verifiedName: string | null
  phoneNumberIdMasked: string
  businessAccountIdMasked: string
  appIdMasked: string
  webhookPath: string | null
  webhookVerifyTokenConfigured: boolean
  sendMessagesEnabled: boolean
  webhookEnabled: boolean
  lastConfigCheckAt: string | null
  lastConfigCheckStatus: string | null
  lastConfigCheckMessage: string | null
  updatedAt: string
  /** Presence-only env checklist (never secret values). */
  env: WhatsAppSafeConfig
  issues: string[]
  warnings: string[]
  /** Webhook status (Prompt 17). */
  webhook: {
    enabled: boolean
    verifySignature: boolean
    hasVerifyToken: boolean
    path: string
    lastWebhookVerifiedAt: string | null
    lastMessageReceivedAt: string | null
    recentEventsCount: number
  }
  /** Send status (Prompt 18). */
  send: {
    enabled: boolean
    mockMode: boolean
    require24hWindow: boolean
    lastMessageSentAt: string | null
    sentToday: number
    failedToday: number
  }
}

/** Ensures a row exists for the clinic (idempotent) and returns the raw record. */
async function ensureRow(clinicId: string) {
  const existing = await prisma.whatsAppIntegration.findUnique({ where: { clinicId } })
  if (existing) return existing
  const ids = getWhatsAppEnvIds()
  return prisma.whatsAppIntegration.create({
    data: {
      clinicId,
      webhookPath: ids.webhookPath,
    },
  })
}

function toView(
  row: Awaited<ReturnType<typeof ensureRow>>,
  liveStatus: WhatsAppIntegrationStatus,
  env: WhatsAppSafeConfig,
  issues: string[],
  warnings: string[],
  recentEventsCount = 0,
  sentToday = 0,
  failedToday = 0
): WhatsAppIntegrationView {
  const webhookFlags = getWhatsAppWebhookFlags()
  const sendFlags = getWhatsAppSendFlags()
  return {
    webhook: {
      enabled: webhookFlags.webhookEnabled,
      verifySignature: webhookFlags.verifySignature,
      hasVerifyToken: webhookFlags.hasVerifyToken,
      path: webhookFlags.webhookPath,
      lastWebhookVerifiedAt: row.lastWebhookVerifiedAt ? row.lastWebhookVerifiedAt.toISOString() : null,
      lastMessageReceivedAt: row.lastMessageReceivedAt ? row.lastMessageReceivedAt.toISOString() : null,
      recentEventsCount,
    },
    send: {
      enabled: sendFlags.sendMessagesEnabled,
      mockMode: sendFlags.sendMockMode,
      require24hWindow: sendFlags.require24hWindow,
      lastMessageSentAt: row.lastMessageSentAt ? row.lastMessageSentAt.toISOString() : null,
      sentToday,
      failedToday,
    },
    id: row.id,
    enabled: row.enabled,
    provider: row.provider,
    status: liveStatus,
    displayPhoneNumber: row.displayPhoneNumber,
    verifiedName: row.verifiedName,
    phoneNumberIdMasked: maskWhatsAppId(row.phoneNumberId),
    businessAccountIdMasked: maskWhatsAppId(row.businessAccountId),
    appIdMasked: maskWhatsAppId(row.appId),
    webhookPath: row.webhookPath,
    webhookVerifyTokenConfigured: row.webhookVerifyTokenConfigured,
    sendMessagesEnabled: row.sendMessagesEnabled,
    webhookEnabled: row.webhookEnabled,
    lastConfigCheckAt: row.lastConfigCheckAt ? row.lastConfigCheckAt.toISOString() : null,
    lastConfigCheckStatus: row.lastConfigCheckStatus,
    lastConfigCheckMessage: row.lastConfigCheckMessage,
    updatedAt: row.updatedAt.toISOString(),
    env,
    issues,
    warnings,
  }
}

/** Reads the integration view for a clinic (creates the row if missing). */
export async function getWhatsAppIntegration(clinicId: string): Promise<WhatsAppIntegrationView> {
  const row = await ensureRow(clinicId)
  const env = getWhatsAppRuntimeConfig()
  const validation = validateWhatsAppEnv()
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const [recentEventsCount, sentToday, failedToday] = await Promise.all([
    prisma.whatsAppWebhookEvent.count({ where: { clinicId } }),
    prisma.message.count({
      where: { clinicId, externalChannel: "WHATSAPP", direction: "OUTBOUND", deliveryStatus: { in: ["SENT", "DELIVERED", "READ", "MOCK_SENT"] }, createdAt: { gte: startOfDay } },
    }),
    prisma.message.count({
      where: { clinicId, externalChannel: "WHATSAPP", direction: "OUTBOUND", deliveryStatus: "FAILED", createdAt: { gte: startOfDay } },
    }),
  ])
  // Live status combines env config with the clinic's `enabled` toggle: if the
  // clinic turned it off, it's DISABLED regardless of env.
  const liveStatus = !row.enabled && validation.status !== "NOT_CONFIGURED" ? "DISABLED" : validation.status
  return toView(row, liveStatus, env, validation.issues, validation.warnings, recentEventsCount, sentToday, failedToday)
}

/** Updates the editable fields (enabled/displayPhoneNumber/verifiedName). */
export async function updateWhatsAppIntegration(
  clinicId: string,
  userId: string,
  rawInput: UpdateWhatsAppIntegrationInput
): Promise<WhatsAppIntegrationView> {
  const input = updateWhatsAppIntegrationSchema.parse(rawInput)
  const before = await ensureRow(clinicId)

  const row = await prisma.whatsAppIntegration.update({
    where: { clinicId },
    data: {
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      ...(input.displayPhoneNumber !== undefined ? { displayPhoneNumber: input.displayPhoneNumber } : {}),
      ...(input.verifiedName !== undefined ? { verifiedName: input.verifiedName } : {}),
    },
  })

  const env = getWhatsAppRuntimeConfig()
  const validation = validateWhatsAppEnv()
  const liveStatus = !row.enabled && validation.status !== "NOT_CONFIGURED" ? "DISABLED" : validation.status

  await createAuditLog({
    clinicId,
    userId,
    action: AuditAction.WHATSAPP_INTEGRATION_UPDATED,
    entity: "WhatsAppIntegration",
    entityId: row.id,
    description: "Integração WhatsApp atualizada.",
    // Safe metadata only — never secret values.
    metadata: {
      integrationId: row.id,
      enabledBefore: before.enabled,
      enabledAfter: row.enabled,
      hasAccessToken: env.hasAccessToken,
      hasPhoneNumberId: env.hasPhoneNumberId,
      hasBusinessAccountId: env.hasBusinessAccountId,
      hasWebhookVerifyToken: env.hasWebhookVerifyToken,
    },
  })

  return toView(row, liveStatus, env, validation.issues, validation.warnings)
}

/**
 * Verifies the WhatsApp config WITHOUT sending a message or calling the Graph
 * API (presence/consistency only). Syncs non-sensitive env ids into the row,
 * persists lastConfigCheck*, and audits the result.
 */
export async function checkWhatsAppIntegrationConfig(
  clinicId: string,
  userId: string
): Promise<WhatsAppIntegrationView> {
  await ensureRow(clinicId)
  const env = getWhatsAppRuntimeConfig()
  const validation = validateWhatsAppEnv()
  const ids = getWhatsAppEnvIds()
  const message = statusMessage(validation)

  const rowEnabled = (await prisma.whatsAppIntegration.findUniqueOrThrow({ where: { clinicId }, select: { enabled: true } })).enabled
  const liveStatus = !rowEnabled && validation.status !== "NOT_CONFIGURED" ? "DISABLED" : validation.status

  const row = await prisma.whatsAppIntegration.update({
    where: { clinicId },
    data: {
      // Sync non-sensitive ids from env; NEVER the token/secret/verify token.
      phoneNumberId: ids.phoneNumberId,
      businessAccountId: ids.businessAccountId,
      appId: ids.appId,
      webhookPath: ids.webhookPath,
      webhookVerifyTokenConfigured: ids.webhookVerifyTokenConfigured,
      sendMessagesEnabled: ids.sendMessagesEnabled,
      webhookEnabled: ids.webhookEnabled,
      status: liveStatus as WhatsAppIntegrationStatus,
      lastConfigCheckAt: new Date(),
      lastConfigCheckStatus: liveStatus,
      lastConfigCheckMessage: message,
    },
  })

  await createAuditLog({
    clinicId,
    userId,
    action: AuditAction.WHATSAPP_CONFIG_CHECKED,
    entity: "WhatsAppIntegration",
    entityId: row.id,
    description: `Configuração WhatsApp verificada: ${liveStatus}.`,
    metadata: {
      integrationId: row.id,
      status: liveStatus,
      hasAccessToken: env.hasAccessToken,
      hasPhoneNumberId: env.hasPhoneNumberId,
      hasBusinessAccountId: env.hasBusinessAccountId,
      hasWebhookVerifyToken: env.hasWebhookVerifyToken,
      issuesCount: validation.issues.length,
    },
  })

  if (validation.status === "INVALID_CONFIG") {
    await createAuditLog({
      clinicId,
      userId,
      action: AuditAction.WHATSAPP_CONFIG_INVALID,
      entity: "WhatsAppIntegration",
      entityId: row.id,
      description: "Configuração WhatsApp inválida.",
      metadata: { integrationId: row.id, issuesCount: validation.issues.length },
    })
  } else if (validation.status === "READY_FOR_WEBHOOK" || validation.status === "READY_FOR_SEND" || validation.status === "CONFIGURED") {
    await createAuditLog({
      clinicId,
      userId,
      action: AuditAction.WHATSAPP_CONFIG_READY,
      entity: "WhatsAppIntegration",
      entityId: row.id,
      description: `Configuração WhatsApp pronta: ${validation.status}.`,
      metadata: { integrationId: row.id, status: validation.status },
    })
  }

  return toView(row, liveStatus, env, validation.issues, validation.warnings)
}
