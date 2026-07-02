import { prisma } from "@/lib/prisma"
import { requireApiUser } from "@/lib/api-auth"
import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"
import { successResponse, errorResponse } from "@/lib/api-response"
import { conversationActionSchema } from "@/lib/validators/conversation"
import { canManageConversations, canAssignConversationToOthers } from "@/lib/permissions"
import {
  CONVERSATION_ACTIONS,
  canPerformConversationAction,
} from "@/lib/conversations/constants"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const auth = await requireApiUser()
  if (!auth.ok) {
    return errorResponse(auth.message, auth.status)
  }

  const { conversationId } = await params

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, clinicId: auth.user.clinicId },
    select: {
      id: true,
      status: true,
      assignedUserId: true,
      contactName: true,
      patient: { select: { name: true } },
    },
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
      description: "Tentativa não permitida de alterar conversa.",
    })
    return errorResponse("Você não tem permissão para alterar conversas.", 403)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse("Requisição inválida.", 400)
  }

  const parsed = conversationActionSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "Dados inválidos.", 422)
  }

  const { action, assignedUserId } = parsed.data
  const def = CONVERSATION_ACTIONS[action]

  if (!canPerformConversationAction(action, conversation.status)) {
    return errorResponse("Esta ação não é permitida para a conversa.", 422)
  }

  // Assigning to an arbitrary user is an OWNER/ADMIN action. RECEPTIONIST
  // self-assigns via "take" instead.
  if (action === "assign" && !canAssignConversationToOthers(auth.user.role)) {
    return errorResponse("Você não tem permissão para atribuir conversas a outros usuários.", 403)
  }

  // Resolve the new assignee and the actor name used in the system message.
  let newAssigneeId: string | null = conversation.assignedUserId
  let actorName = auth.user.name

  if (def.assignee === "self") {
    newAssigneeId = auth.user.id
    actorName = auth.user.name
  } else if (def.assignee === null) {
    newAssigneeId = null
  } else if (def.assignee === "input") {
    const target = await prisma.user.findFirst({
      where: { id: assignedUserId, clinicId: auth.user.clinicId, status: "ACTIVE" },
      select: { id: true, name: true },
    })
    if (!target) {
      return errorResponse("Usuário não encontrado ou não pertence à clínica atual.", 422)
    }
    newAssigneeId = target.id
    actorName = target.name
  }

  const displayName = conversation.patient?.name ?? conversation.contactName ?? "contato"

  try {
    await prisma.$transaction(async (tx) => {
      await tx.conversation.update({
        where: { id: conversation.id },
        data: { status: def.status, assignedUserId: newAssigneeId },
      })
      await tx.message.create({
        data: {
          clinicId: auth.user.clinicId,
          conversationId: conversation.id,
          direction: "OUTBOUND",
          senderType: "SYSTEM",
          content: def.systemMessage(actorName),
        },
      })
    })

    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: def.auditAction,
      entity: "Conversation",
      entityId: conversation.id,
      description: auditDescription(action, displayName, actorName),
      metadata: {
        conversationId: conversation.id,
        oldStatus: conversation.status,
        newStatus: def.status,
        assignedUserId: newAssigneeId,
      },
    })

    return successResponse({ id: conversation.id })
  } catch (error) {
    return errorResponse("Não foi possível atualizar a conversa.", 500, {
      code: "INTERNAL_ERROR",
      logContext: "conversations.action",
      logError: error,
      logMetadata: { clinicId: auth.user.clinicId, conversationId: conversation.id, action },
    })
  }
}

function auditDescription(
  action: string,
  displayName: string,
  actorName: string
): string {
  switch (action) {
    case "take":
      return `Atendimento da conversa com ${displayName} foi assumido por ${actorName}.`
    case "assign":
      return `Conversa com ${displayName} foi atribuída a ${actorName}.`
    case "transfer":
      return `Conversa com ${displayName} foi transferida para atendimento humano.`
    case "return_to_ai":
      return `Conversa com ${displayName} foi devolvida para Sinery Assist em preparação.`
    case "close":
      return `Conversa com ${displayName} foi encerrada.`
    case "reopen":
      return `Conversa com ${displayName} foi reaberta.`
    default:
      return `Conversa com ${displayName} foi atualizada.`
  }
}
