import { prisma } from "@/lib/prisma"
import { requireApiUser } from "@/lib/api-auth"
import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"
import { successResponse, errorResponse } from "@/lib/api-response"
import { createKnowledgeBaseSchema } from "@/lib/validators/assist"
import { canManageKnowledgeBase } from "@/lib/permissions"

export async function POST(request: Request) {
  const auth = await requireApiUser()
  if (!auth.ok) {
    return errorResponse(auth.message, auth.status)
  }

  if (!canManageKnowledgeBase(auth.user.role)) {
    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.ASSIST_ACCESS_DENIED,
      entity: "AiKnowledgeBase",
      description: "Tentativa não permitida de criar item de conhecimento.",
    })
    return errorResponse("Você não tem permissão para gerenciar a base de conhecimento.", 403)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse("Requisição inválida.", 400)
  }

  const parsed = createKnowledgeBaseSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "Dados inválidos.", 422)
  }

  try {
    const item = await prisma.aiKnowledgeBase.create({
      data: {
        clinicId: auth.user.clinicId,
        title: parsed.data.title,
        content: parsed.data.content,
        active: true,
      },
      select: { id: true, title: true },
    })

    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.AI_KNOWLEDGE_CREATED,
      entity: "AiKnowledgeBase",
      entityId: item.id,
      description: `Item de conhecimento "${item.title}" foi criado.`,
    })

    return successResponse({ id: item.id }, 201)
  } catch (error) {
    return errorResponse("Não foi possível criar o item de conhecimento.", 500, {
      code: "INTERNAL_ERROR",
      logContext: "assist.knowledge.create",
      logError: error,
      logMetadata: { clinicId: auth.user.clinicId },
    })
  }
}
