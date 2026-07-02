import { prisma } from "@/lib/prisma"
import { requireApiUser } from "@/lib/api-auth"
import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"
import { successResponse, errorResponse } from "@/lib/api-response"
import { professionalFormSchema } from "@/lib/validators/professional"
import { canCreateProfessional } from "@/lib/permissions"

export async function POST(request: Request) {
  const auth = await requireApiUser()
  if (!auth.ok) {
    return errorResponse(auth.message, auth.status)
  }

  if (!canCreateProfessional(auth.user.role)) {
    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.PROFESSIONAL_ACCESS_DENIED,
      entity: "Professional",
      description: "Tentativa não permitida de cadastrar profissional.",
    })
    return errorResponse("Você não tem permissão para cadastrar profissionais.", 403)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse("Requisição inválida.", 400)
  }

  const parsed = professionalFormSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "Dados inválidos.", 422)
  }

  const { name, email, phone, specialty } = parsed.data

  try {
    // Always created under the logged-in user's own clinicId — the client
    // never supplies (or controls) which clinic a professional belongs to.
    const professional = await prisma.professional.create({
      data: {
        clinicId: auth.user.clinicId,
        name,
        email: email ?? null,
        phone: phone ?? null,
        specialty: specialty ?? null,
        status: "ACTIVE",
      },
      select: { id: true, name: true },
    })

    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.PROFESSIONAL_CREATED,
      entity: "Professional",
      entityId: professional.id,
      description: `Profissional ${professional.name} foi cadastrado.`,
    })

    return successResponse({ id: professional.id }, 201)
  } catch (error) {
    return errorResponse("Não foi possível cadastrar o profissional.", 500, {
      code: "INTERNAL_ERROR",
      logContext: "professionals.create",
      logError: error,
      logMetadata: { clinicId: auth.user.clinicId },
    })
  }
}
