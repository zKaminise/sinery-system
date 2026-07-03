import "server-only"

import { prisma } from "@/lib/prisma"
import { Prisma } from "@/lib/generated/prisma/client"
import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"
import { deriveAssistState } from "@/lib/assist/assist-state"
import type { AssistTurn, AiTurnMeta } from "@/lib/assist/types"

/**
 * Saves the inbound (simulated) patient message and records the receive audit.
 * Shared by the rule-based and OpenAI provider paths.
 */
export async function saveInboundPatientMessage(
  clinicId: string,
  conversationId: string,
  userId: string,
  text: string
): Promise<void> {
  await prisma.message.create({
    data: { clinicId, conversationId, direction: "INBOUND", senderType: "PATIENT", content: text },
  })
  await createAuditLog({
    clinicId,
    userId,
    action: AuditAction.ASSIST_MESSAGE_RECEIVED,
    entity: "Conversation",
    entityId: conversationId,
    description: "Mensagem simulada recebida pela Sinery Assist.",
    metadata: { conversationId },
  })
}

/**
 * Persists a completed assistant turn: writes the reply messages, updates the
 * conversation status + metadata (flow state + AI meta), and records the
 * turn's audits plus a final "message sent" event. Used by both providers so
 * persistence stays in one place.
 */
export async function persistAssistTurn(
  clinicId: string,
  conversationId: string,
  userId: string,
  turn: AssistTurn,
  aiMeta: AiTurnMeta
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (const reply of turn.replies) {
      await tx.message.create({
        data: {
          clinicId,
          conversationId,
          direction: "OUTBOUND",
          senderType: reply.senderType,
          content: reply.content,
        },
      })
    }
    // Persist the internal flow (engine source of truth), the last AI meta,
    // AND a standardized denormalized `assist` view (Prompt 14) for the UI +
    // helpers. suggestedSlots are cleared automatically when a flow ends
    // (turn.flow has no slots at COMPLETED/TRANSFERRED_TO_HUMAN).
    const assist = deriveAssistState(turn.flow ?? null, aiMeta, null)
    await tx.conversation.update({
      where: { id: conversationId },
      data: {
        ...(turn.status ? { status: turn.status } : {}),
        metadata: {
          ...(turn.flow ? { assistFlow: turn.flow } : {}),
          aiMeta,
          assist,
        } as unknown as Prisma.InputJsonValue,
      },
    })
  })

  for (const audit of turn.audits) {
    await createAuditLog({
      clinicId,
      userId,
      action: audit.action,
      entity: "Conversation",
      entityId: conversationId,
      description: audit.description,
      metadata: (audit.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    })
  }
  await createAuditLog({
    clinicId,
    userId,
    action: AuditAction.ASSIST_MESSAGE_SENT,
    entity: "Conversation",
    entityId: conversationId,
    description: "Resposta enviada pela Sinery Assist.",
    metadata: { conversationId, mode: aiMeta.mode },
  })
}
