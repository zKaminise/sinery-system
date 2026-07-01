import { prisma } from "@/lib/prisma"
import { requireApiUser } from "@/lib/api-auth"
import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"
import { successResponse, errorResponse } from "@/lib/api-response"
import { updateUserSchema, updateUserStatusSchema } from "@/lib/validators/settings"
import {
  canEditUser,
  canEditUserRole,
  canDeactivateUser,
} from "@/lib/permissions"

/** Counts ACTIVE owners in a clinic, used to protect the last owner. */
async function countActiveOwners(clinicId: string): Promise<number> {
  return prisma.user.count({
    where: { clinicId, role: "OWNER", status: "ACTIVE" },
  })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await requireApiUser({ ownerOrAdmin: true })
  if (!auth.ok) {
    return errorResponse(auth.message, auth.status)
  }

  const { userId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse("Requisição inválida.", 400)
  }

  const action = (body as { action?: string } | null)?.action

  // Target must exist AND belong to the same clinic — this is the tenant guard.
  const target = await prisma.user.findFirst({
    where: { id: userId, clinicId: auth.user.clinicId },
    select: { id: true, name: true, role: true, status: true, clinicId: true },
  })
  if (!target) {
    return errorResponse("Usuário não encontrado.", 404)
  }

  const actor = { id: auth.user.id, role: auth.user.role, clinicId: auth.user.clinicId }

  // --- Update name / role -------------------------------------------------
  if (action === "update") {
    if (!canEditUser(actor, target)) {
      return errorResponse("Você não tem permissão para editar este usuário.", 403)
    }

    const parsed = updateUserSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message ?? "Dados inválidos.", 422)
    }
    const { name, role } = parsed.data
    const roleChanged = role !== target.role

    if (roleChanged) {
      if (!canEditUserRole(actor, target, role)) {
        return errorResponse("Você não pode atribuir essa função.", 403)
      }
      // Demoting the last active owner would leave the clinic ownerless.
      if (target.role === "OWNER" && role !== "OWNER") {
        const activeOwners = await countActiveOwners(auth.user.clinicId)
        if (activeOwners <= 1) {
          return errorResponse(
            "Não é possível remover a função do último proprietário ativo da clínica.",
            409
          )
        }
      }
    }

    try {
      const updated = await prisma.user.update({
        where: { id: target.id },
        data: { name, role },
        select: { id: true, name: true },
      })

      await createAuditLog({
        clinicId: auth.user.clinicId,
        userId: auth.user.id,
        action: AuditAction.USER_UPDATED,
        entity: "User",
        entityId: updated.id,
        description: `Usuário ${updated.name} foi atualizado.`,
      })
      if (roleChanged) {
        await createAuditLog({
          clinicId: auth.user.clinicId,
          userId: auth.user.id,
          action: AuditAction.USER_ROLE_CHANGED,
          entity: "User",
          entityId: updated.id,
          description: `Função do usuário ${updated.name} foi alterada.`,
          metadata: { from: target.role, to: role },
        })
      }

      return successResponse({ id: updated.id })
    } catch (error) {
      return errorResponse("Não foi possível atualizar o usuário.", 500, {
        code: "INTERNAL_ERROR",
        logContext: "settings.users.update",
        logError: error,
      })
    }
  }

  // --- Change status (activate / deactivate) ------------------------------
  if (action === "status") {
    const parsed = updateUserStatusSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message ?? "Dados inválidos.", 422)
    }
    const { status } = parsed.data

    if (status === "INACTIVE") {
      if (auth.user.id === target.id) {
        return errorResponse("Você não pode inativar a si mesmo.", 409)
      }
      if (!canDeactivateUser(actor, target)) {
        return errorResponse("Você não tem permissão para inativar este usuário.", 403)
      }
      if (target.role === "OWNER" && target.status === "ACTIVE") {
        const activeOwners = await countActiveOwners(auth.user.clinicId)
        if (activeOwners <= 1) {
          return errorResponse(
            "Não é possível inativar o último proprietário ativo da clínica.",
            409
          )
        }
      }
    } else {
      // Reactivating: ADMIN still can't touch an OWNER.
      if (!canEditUser(actor, target)) {
        return errorResponse("Você não tem permissão para alterar este usuário.", 403)
      }
    }

    try {
      const updated = await prisma.user.update({
        where: { id: target.id },
        data: { status },
        select: { id: true, name: true },
      })

      await createAuditLog({
        clinicId: auth.user.clinicId,
        userId: auth.user.id,
        action: AuditAction.USER_STATUS_CHANGED,
        entity: "User",
        entityId: updated.id,
        description: `Status do usuário ${updated.name} foi alterado para ${
          status === "ACTIVE" ? "ativo" : "inativo"
        }.`,
        metadata: { status },
      })

      return successResponse({ id: updated.id })
    } catch (error) {
      return errorResponse("Não foi possível alterar o status do usuário.", 500, {
        code: "INTERNAL_ERROR",
        logContext: "settings.users.status",
        logError: error,
      })
    }
  }

  return errorResponse("Ação inválida.", 400)
}
