import { prisma } from "@/lib/prisma"
import { requireApiUser } from "@/lib/api-auth"
import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"
import { successResponse, errorResponse } from "@/lib/api-response"
import { createUserSchema } from "@/lib/validators/settings"
import { canCreateUserWithRole } from "@/lib/permissions"
import { generateProvisionalPassword, hashPassword } from "@/lib/password"

export async function POST(request: Request) {
  const auth = await requireApiUser({ ownerOrAdmin: true })
  if (!auth.ok) {
    return errorResponse(auth.message, auth.status)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse("Requisição inválida.", 400)
  }

  const parsed = createUserSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "Dados inválidos.", 422)
  }

  const { name, email, role } = parsed.data

  // Role escalation guard: ADMIN can only create RECEPTIONIST/PROFESSIONAL.
  if (!canCreateUserWithRole(auth.user.role, role)) {
    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.USER_ACCESS_DENIED,
      entity: "User",
      description: `Tentativa não permitida de criar usuário com função ${role}.`,
    })
    return errorResponse("Você não pode criar um usuário com essa função.", 403)
  }

  // Email must be unique within the clinic (same email may exist in others).
  const existing = await prisma.user.findUnique({
    where: { clinicId_email: { clinicId: auth.user.clinicId, email } },
    select: { id: true },
  })
  if (existing) {
    return errorResponse("Já existe um usuário com este e-mail nesta clínica.", 409, {
      code: "BAD_REQUEST",
    })
  }

  try {
    // The plaintext provisional password is generated here, hashed, and only
    // the hash is stored. The plaintext is returned to the caller exactly once
    // and never logged, audited, or persisted.
    const provisionalPassword = generateProvisionalPassword()
    const passwordHash = await hashPassword(provisionalPassword)

    const user = await prisma.user.create({
      data: {
        clinicId: auth.user.clinicId,
        name,
        email,
        role,
        passwordHash,
        status: "ACTIVE",
        temporaryPassword: true,
      },
      select: { id: true, name: true },
    })

    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.USER_CREATED,
      entity: "User",
      entityId: user.id,
      description: `Usuário ${user.name} foi criado.`,
      // NOTE: never include the provisional password in metadata.
      metadata: { role },
    })

    return successResponse({ id: user.id, provisionalPassword }, 201)
  } catch (error) {
    return errorResponse("Não foi possível criar o usuário.", 500, {
      code: "INTERNAL_ERROR",
      logContext: "settings.users.create",
      logError: error,
      logMetadata: { clinicId: auth.user.clinicId },
    })
  }
}
