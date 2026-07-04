import { prisma } from "@/lib/prisma"
import { requireApiUser } from "@/lib/api-auth"
import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"
import { successResponse, errorResponse } from "@/lib/api-response"
import { canManageConversations } from "@/lib/permissions"
import { processWhatsAppInboundWithAssist } from "@/lib/whatsapp/whatsapp-assist-processor"

/**
 * Manually runs the Sinery Assist on a WhatsApp conversation's last inbound
 * message (button in the inbox). If the conversation was WAITING_HUMAN, it is
 * returned to AI_HANDLING first. OWNER/ADMIN/RECEPTIONIST only. Idempotent (the
 * processor skips an already-processed inbound).
 */
export async function POST(request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const auth = await requireApiUser()
  if (!auth.ok) return errorResponse(auth.message, auth.status)

  const { conversationId } = await params

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, clinicId: auth.user.clinicId },
    select: { id: true, channel: true, status: true },
  })
  if (!conversation) return errorResponse("Conversa não encontrada.", 404)

  if (!canManageConversations(auth.user.role)) {
    return errorResponse("Você não tem permissão para acionar a Sinery Assist.", 403)
  }
  if (conversation.channel !== "WHATSAPP") {
    return errorResponse("Ação disponível apenas para conversas WhatsApp.", 400)
  }
  if (conversation.status === "CLOSED") {
    return errorResponse("Reabra a conversa antes de acionar a Assist.", 409)
  }

  const lastInbound = await prisma.message.findFirst({
    where: { clinicId: auth.user.clinicId, conversationId, direction: "INBOUND", senderType: "PATIENT" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  })
  if (!lastInbound) return errorResponse("Não há mensagem do paciente para processar.", 409)

  // Return to the Assist first if a human was handling / waiting.
  if (conversation.status !== "AI_HANDLING") {
    await prisma.$transaction([
      prisma.conversation.update({ where: { id: conversationId }, data: { status: "AI_HANDLING", assignedUserId: null } }),
      prisma.message.create({
        data: { clinicId: auth.user.clinicId, conversationId, direction: "OUTBOUND", senderType: "SYSTEM", content: "Conversa devolvida para a Sinery Assist." },
      }),
    ])
    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.WHATSAPP_ASSIST_ENABLED_FOR_CONVERSATION,
      entity: "Conversation",
      entityId: conversationId,
      description: "Conversa devolvida para a Sinery Assist (WhatsApp).",
      metadata: { conversationId, oldStatus: conversation.status },
    })
  }

  try {
    const result = await processWhatsAppInboundWithAssist({
      clinicId: auth.user.clinicId,
      conversationId,
      inboundMessageId: lastInbound.id,
      trigger: "MANUAL_BUTTON",
      userId: auth.user.id,
    })
    return successResponse({ id: conversationId, outcome: result.outcome, deliveryStatus: result.deliveryStatus })
  } catch {
    return errorResponse("Não foi possível processar a mensagem com a Sinery Assist.", 500)
  }
}
