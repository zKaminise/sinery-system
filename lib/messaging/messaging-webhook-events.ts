import "server-only"

import { prisma } from "@/lib/prisma"
import type { MessagingProvider } from "@/lib/messaging/messaging-types"

export interface RecordMessagingEventInput {
  clinicId: string | null
  provider: MessagingProvider
  eventType: string
  externalMessageId?: string | null
  instanceName?: string | null
  fromPhone?: string | null
  payloadHash: string
}

/**
 * Records a provider-agnostic inbound webhook event for idempotency. Returns the
 * new row, or null when it's a duplicate (unique payloadHash). NEVER stores the
 * raw payload or any secret.
 */
export async function recordMessagingEvent(input: RecordMessagingEventInput): Promise<{ id: string } | null> {
  const existing = await prisma.messagingWebhookEvent.findUnique({
    where: { payloadHash: input.payloadHash },
    select: { id: true },
  })
  if (existing) return null
  try {
    return await prisma.messagingWebhookEvent.create({
      data: {
        clinicId: input.clinicId,
        provider: input.provider,
        eventType: input.eventType,
        externalMessageId: input.externalMessageId ?? null,
        instanceName: input.instanceName ?? null,
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

export async function markMessagingEventProcessed(id: string, opts: { ignored?: boolean; errorCode?: string } = {}): Promise<void> {
  await prisma.messagingWebhookEvent
    .update({
      where: { id },
      data: { processed: !opts.ignored, ignored: Boolean(opts.ignored), errorCode: opts.errorCode ?? null, processedAt: new Date() },
    })
    .catch(() => {})
}
