import { prisma } from "@/lib/prisma"
import { requireApiUser } from "@/lib/api-auth"
import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"
import { successResponse, errorResponse } from "@/lib/api-response"
import { sendMessageSchema } from "@/lib/validators/conversation"
import { canManageConversations, canSendWhatsAppMessage } from "@/lib/permissions"
import { getWhatsAppSendFlags } from "@/lib/whatsapp/whatsapp-config"
import { sendWhatsAppTextMessage } from "@/lib/whatsapp/whatsapp-send-service"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const auth = await requireApiUser()
  if (!auth.ok) {
    return errorResponse(auth.message, auth.status)
  }

  const { conversationId } = await params

  // Tenant guard: a conversation from another clinic simply doesn't exist.
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, clinicId: auth.user.clinicId },
    select: { id: true, status: true, assignedUserId: true, channel: true },
  })
  if (!conversation) {
    return errorResponse("Conversa não encontrada.", 404)
  }

  if (!canManageConversations(auth.user.role)) {
    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.CONVERSATION_ACCESS_DENIED,
      entity: "Conversation",
      entityId: conversation.id,
      description: "Tentativa não permitida de enviar mensagem.",
    })
    return errorResponse("Você não tem permissão para enviar mensagens.", 403)
  }

  if (conversation.status === "CLOSED") {
    return errorResponse("Reabra a conversa para enviar uma nova mensagem.", 409)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse("Requisição inválida.", 400)
  }

  const parsed = sendMessageSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "Dados inválidos.", 422)
  }

  // WHATSAPP conversations: real (or mocked) send via the Graph API. The
  // send-service enforces integration/window/token; the destination phone comes
  // from the Conversation, never the frontend. INTERNAL_SIMULATOR is unchanged.
  if (conversation.channel === "WHATSAPP") {
    if (!canSendWhatsAppMessage(auth.user.role)) {
      return errorResponse("Você não tem permissão para enviar mensagens pelo WhatsApp.", 403)
    }
    if (!getWhatsAppSendFlags().sendMessagesEnabled) {
      return errorResponse("Envio real pelo WhatsApp está desativado nas configurações.", 409)
    }
    const result = await sendWhatsAppTextMessage({
      clinicId: auth.user.clinicId,
      conversationId: conversation.id,
      text: parsed.data.content,
      sentByUserId: auth.user.id,
      sentByUserName: auth.user.name,
    })
    if (!result.ok) return errorResponse(result.message, result.httpStatus)
    return successResponse({ id: conversation.id, messageId: result.messageId, deliveryStatus: result.deliveryStatus, mock: result.mock }, 201)
  }

  // Sending a human message auto-assumes the conversation: when it was waiting
  // or with the (future) AI, it becomes HUMAN_HANDLING assigned to the sender.
  const shouldAutoAssume =
    conversation.status === "WAITING_HUMAN" || conversation.status === "AI_HANDLING"

  try {
    await prisma.$transaction(async (tx) => {
      if (shouldAutoAssume) {
        await tx.message.create({
          data: {
            clinicId: auth.user.clinicId,
            conversationId: conversation.id,
            direction: "OUTBOUND",
            senderType: "SYSTEM",
            content: `Atendimento assumido por ${auth.user.name}.`,
          },
        })
      }

      await tx.message.create({
        data: {
          clinicId: auth.user.clinicId,
          conversationId: conversation.id,
          direction: "OUTBOUND",
          senderType: "HUMAN",
          content: parsed.data.content,
          metadata: { userId: auth.user.id, userName: auth.user.name },
        },
      })

      // Always update the conversation (bumps updatedAt); also flips status/
      // assignee when auto-assuming.
      await tx.conversation.update({
        where: { id: conversation.id },
        data: shouldAutoAssume
          ? { status: "HUMAN_HANDLING", assignedUserId: auth.user.id }
          : { status: conversation.status },
      })
    })

    if (shouldAutoAssume) {
      await createAuditLog({
        clinicId: auth.user.clinicId,
        userId: auth.user.id,
        action: AuditAction.CONVERSATION_TAKEN,
        entity: "Conversation",
        entityId: conversation.id,
        description: `Atendimento foi assumido por ${auth.user.name}.`,
        metadata: {
          conversationId: conversation.id,
          oldStatus: conversation.status,
          newStatus: "HUMAN_HANDLING",
        },
      })
    }

    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.MESSAGE_SENT,
      entity: "Conversation",
      entityId: conversation.id,
      description: "Mensagem humana enviada na conversa.",
      metadata: { conversationId: conversation.id },
    })

    return successResponse({ id: conversation.id }, 201)
  } catch (error) {
    return errorResponse("Não foi possível enviar a mensagem.", 500, {
      code: "INTERNAL_ERROR",
      logContext: "conversations.message",
      logError: error,
      logMetadata: { clinicId: auth.user.clinicId, conversationId: conversation.id },
    })
  }
}
