import { prisma } from "@/lib/prisma"
import { requireApiUser } from "@/lib/api-auth"
import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"
import { successResponse, errorResponse } from "@/lib/api-response"
import { createConversationSchema } from "@/lib/validators/conversation"
import { canManageConversations } from "@/lib/permissions"

export async function POST(request: Request) {
  const auth = await requireApiUser()
  if (!auth.ok) {
    return errorResponse(auth.message, auth.status)
  }

  if (!canManageConversations(auth.user.role)) {
    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.CONVERSATION_ACCESS_DENIED,
      entity: "Conversation",
      description: "Tentativa não permitida de criar conversa.",
    })
    return errorResponse("Você não tem permissão para criar conversas.", 403)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse("Requisição inválida.", 400)
  }

  const parsed = createConversationSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "Dados inválidos.", 422)
  }

  const { patientId, contactName, contactPhone, initialMessage, status } = parsed.data

  // Resolve contact identity. When a patient is chosen it's the source of
  // truth; otherwise the manually-typed contact name/phone are used.
  let resolvedName = contactName ?? null
  let resolvedPhone = contactPhone ?? null

  if (patientId) {
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, clinicId: auth.user.clinicId },
      select: { id: true, name: true, phone: true },
    })
    if (!patient) {
      return errorResponse("Paciente não encontrado ou não pertence à clínica atual.", 422)
    }
    resolvedName = patient.name
    resolvedPhone = patient.phone
  }

  try {
    const conversation = await prisma.$transaction(async (tx) => {
      const conv = await tx.conversation.create({
        data: {
          clinicId: auth.user.clinicId,
          patientId: patientId ?? null,
          channel: "INTERNAL_SIMULATOR",
          status,
          contactName: resolvedName,
          contactPhone: resolvedPhone,
        },
        select: { id: true },
      })

      // A neutral system note marks the conversation as a test one, then the
      // simulated inbound patient message.
      await tx.message.create({
        data: {
          clinicId: auth.user.clinicId,
          conversationId: conv.id,
          direction: "OUTBOUND",
          senderType: "SYSTEM",
          content: "Conversa de teste interna criada.",
        },
      })
      await tx.message.create({
        data: {
          clinicId: auth.user.clinicId,
          conversationId: conv.id,
          direction: "INBOUND",
          senderType: "PATIENT",
          content: initialMessage,
        },
      })

      return conv
    })

    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.CONVERSATION_CREATED,
      entity: "Conversation",
      entityId: conversation.id,
      description: `Conversa de teste com ${resolvedName ?? "contato"} foi criada.`,
      metadata: { patientId: patientId ?? null, status },
    })
    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.MESSAGE_RECEIVED_SIMULATED,
      entity: "Conversation",
      entityId: conversation.id,
      description: "Mensagem simulada recebida na conversa de teste.",
      metadata: { conversationId: conversation.id },
    })

    return successResponse({ id: conversation.id }, 201)
  } catch (error) {
    return errorResponse("Não foi possível criar a conversa.", 500, {
      code: "INTERNAL_ERROR",
      logContext: "conversations.create",
      logError: error,
      logMetadata: { clinicId: auth.user.clinicId },
    })
  }
}
