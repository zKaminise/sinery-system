import { prisma } from "@/lib/prisma"
import { requireApiUser } from "@/lib/api-auth"
import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"
import { successResponse, errorResponse } from "@/lib/api-response"
import { sendAssistSimulatorMessageSchema } from "@/lib/validators/assist"
import { canUseAssistSimulator } from "@/lib/permissions"
import { processAssistMessage } from "@/lib/ai/assist-provider"

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
    select: { id: true, channel: true },
  })
  if (!conversation) {
    return errorResponse("Conversa não encontrada.", 404)
  }

  if (!canUseAssistSimulator(auth.user.role)) {
    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.ASSIST_ACCESS_DENIED,
      entity: "Conversation",
      entityId: conversation.id,
      description: "Tentativa não permitida de enviar mensagem no simulador.",
    })
    return errorResponse("Você não tem permissão para usar o simulador.", 403)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse("Requisição inválida.", 400)
  }

  const parsed = sendAssistSimulatorMessageSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "Dados inválidos.", 422)
  }

  try {
    await processAssistMessage({
      clinicId: auth.user.clinicId,
      conversationId: conversation.id,
      userId: auth.user.id,
      message: parsed.data.content,
    })
    return successResponse({ id: conversation.id }, 201)
  } catch (error) {
    return errorResponse("Não foi possível processar a mensagem.", 500, {
      code: "INTERNAL_ERROR",
      logContext: "assist.simulation.message",
      logError: error,
      logMetadata: { clinicId: auth.user.clinicId, conversationId: conversation.id },
    })
  }
}
