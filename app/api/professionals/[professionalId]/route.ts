import { prisma } from "@/lib/prisma"
import { requireApiUser } from "@/lib/api-auth"
import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"
import { successResponse, errorResponse } from "@/lib/api-response"
import { professionalFormSchema } from "@/lib/validators/professional"
import { canEditProfessional } from "@/lib/permissions"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ professionalId: string }> }
) {
  const auth = await requireApiUser()
  if (!auth.ok) {
    return errorResponse(auth.message, auth.status)
  }

  const { professionalId } = await params

  // Tenant guard: the professional must belong to the logged-in user's
  // clinic. Looking up by id alone would let a user reach another clinic's
  // record by guessing/enumerating ids — never do that.
  const target = await prisma.professional.findFirst({
    where: { id: professionalId, clinicId: auth.user.clinicId },
    select: { id: true, name: true },
  })
  if (!target) {
    return errorResponse("Profissional não encontrado.", 404)
  }

  if (!canEditProfessional(auth.user.role)) {
    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.PROFESSIONAL_ACCESS_DENIED,
      entity: "Professional",
      entityId: target.id,
      description: "Tentativa não permitida de editar profissional.",
    })
    return errorResponse("Você não tem permissão para editar profissionais.", 403)
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
    const updated = await prisma.professional.update({
      where: { id: target.id },
      data: {
        name,
        email: email ?? null,
        phone: phone ?? null,
        specialty: specialty ?? null,
      },
      select: { id: true, name: true },
    })

    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.PROFESSIONAL_UPDATED,
      entity: "Professional",
      entityId: updated.id,
      description: `Dados do profissional ${updated.name} foram atualizados.`,
    })

    return successResponse({ id: updated.id })
  } catch (error) {
    return errorResponse("Não foi possível atualizar o profissional.", 500, {
      code: "INTERNAL_ERROR",
      logContext: "professionals.update",
      logError: error,
      logMetadata: { clinicId: auth.user.clinicId, professionalId: target.id },
    })
  }
}
