import { prisma } from "@/lib/prisma"
import { requireApiUser } from "@/lib/api-auth"
import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"
import { successResponse, errorResponse } from "@/lib/api-response"
import {
  updateKnowledgeBaseSchema,
  updateKnowledgeBaseStatusSchema,
} from "@/lib/validators/assist"
import { canManageKnowledgeBase } from "@/lib/permissions"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ knowledgeId: string }> }
) {
  const auth = await requireApiUser()
  if (!auth.ok) {
    return errorResponse(auth.message, auth.status)
  }

  const { knowledgeId } = await params

  // Tenant guard.
  const existing = await prisma.aiKnowledgeBase.findFirst({
    where: { id: knowledgeId, clinicId: auth.user.clinicId },
    select: { id: true, active: true, title: true },
  })
  if (!existing) {
    return errorResponse("Item de conhecimento não encontrado.", 404)
  }

  if (!canManageKnowledgeBase(auth.user.role)) {
    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.ASSIST_ACCESS_DENIED,
      entity: "AiKnowledgeBase",
      entityId: existing.id,
      description: "Tentativa não permitida de editar item de conhecimento.",
    })
    return errorResponse("Você não tem permissão para gerenciar a base de conhecimento.", 403)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse("Requisição inválida.", 400)
  }

  // A body carrying only `active` is a status toggle; otherwise it's a field edit.
  const isStatusChange =
    body !== null &&
    typeof body === "object" &&
    "active" in body &&
    !("title" in body) &&
    !("content" in body)

  try {
    if (isStatusChange) {
      const parsed = updateKnowledgeBaseStatusSchema.safeParse(body)
      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message ?? "Dados inválidos.", 422)
      }
      await prisma.aiKnowledgeBase.update({
        where: { id: existing.id },
        data: { active: parsed.data.active },
      })
      await createAuditLog({
        clinicId: auth.user.clinicId,
        userId: auth.user.id,
        action: AuditAction.AI_KNOWLEDGE_STATUS_CHANGED,
        entity: "AiKnowledgeBase",
        entityId: existing.id,
        description: `Item de conhecimento "${existing.title}" foi ${parsed.data.active ? "ativado" : "inativado"}.`,
        metadata: { from: existing.active, to: parsed.data.active },
      })
      return successResponse({ id: existing.id })
    }

    const parsed = updateKnowledgeBaseSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message ?? "Dados inválidos.", 422)
    }
    await prisma.aiKnowledgeBase.update({
      where: { id: existing.id },
      data: { title: parsed.data.title, content: parsed.data.content },
    })
    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.AI_KNOWLEDGE_UPDATED,
      entity: "AiKnowledgeBase",
      entityId: existing.id,
      description: `Item de conhecimento "${parsed.data.title}" foi atualizado.`,
    })
    return successResponse({ id: existing.id })
  } catch (error) {
    return errorResponse("Não foi possível atualizar o item de conhecimento.", 500, {
      code: "INTERNAL_ERROR",
      logContext: "assist.knowledge.update",
      logError: error,
      logMetadata: { clinicId: auth.user.clinicId, knowledgeId: existing.id },
    })
  }
}
