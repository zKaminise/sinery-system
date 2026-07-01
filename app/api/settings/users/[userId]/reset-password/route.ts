import { prisma } from "@/lib/prisma"
import { requireApiUser } from "@/lib/api-auth"
import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"
import { successResponse, errorResponse } from "@/lib/api-response"
import { canResetUserPassword } from "@/lib/permissions"
import { generateProvisionalPassword, hashPassword } from "@/lib/password"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await requireApiUser({ ownerOrAdmin: true })
  if (!auth.ok) {
    return errorResponse(auth.message, auth.status)
  }

  const { userId } = await params

  const target = await prisma.user.findFirst({
    where: { id: userId, clinicId: auth.user.clinicId },
    select: { id: true, name: true, role: true, clinicId: true },
  })
  if (!target) {
    return errorResponse("Usuário não encontrado.", 404)
  }

  const actor = { id: auth.user.id, role: auth.user.role, clinicId: auth.user.clinicId }
  if (!canResetUserPassword(actor, target)) {
    return errorResponse("Você não tem permissão para redefinir esta senha.", 403)
  }

  try {
    // Generate a fresh provisional password, store only its hash, and force a
    // password change on next login. The plaintext is returned once and never
    // logged or audited.
    const provisionalPassword = generateProvisionalPassword()
    const passwordHash = await hashPassword(provisionalPassword)

    await prisma.user.update({
      where: { id: target.id },
      data: {
        passwordHash,
        temporaryPassword: true,
        passwordChangedAt: null,
      },
    })

    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.USER_TEMP_PASSWORD_RESET,
      entity: "User",
      entityId: target.id,
      description: `Senha provisória do usuário ${target.name} foi redefinida.`,
    })

    return successResponse({ id: target.id, provisionalPassword })
  } catch (error) {
    return errorResponse("Não foi possível redefinir a senha.", 500, {
      code: "INTERNAL_ERROR",
      logContext: "settings.users.reset-password",
      logError: error,
    })
  }
}
