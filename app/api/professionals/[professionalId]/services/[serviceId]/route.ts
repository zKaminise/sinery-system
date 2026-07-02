import { prisma } from "@/lib/prisma"
import { requireApiUser } from "@/lib/api-auth"
import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"
import { successResponse, errorResponse } from "@/lib/api-response"
import { canManageProfessionalServices } from "@/lib/permissions"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ professionalId: string; serviceId: string }> }
) {
  const auth = await requireApiUser()
  if (!auth.ok) {
    return errorResponse(auth.message, auth.status)
  }

  const { professionalId, serviceId } = await params

  const professional = await prisma.professional.findFirst({
    where: { id: professionalId, clinicId: auth.user.clinicId },
    select: { id: true, name: true },
  })
  if (!professional) {
    return errorResponse("Profissional não encontrado.", 404)
  }

  const service = await prisma.service.findFirst({
    where: { id: serviceId, clinicId: auth.user.clinicId },
    select: { id: true, name: true },
  })
  if (!service) {
    return errorResponse("Serviço não encontrado.", 404)
  }

  if (!canManageProfessionalServices(auth.user.role)) {
    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.PROFESSIONAL_ACCESS_DENIED,
      entity: "ProfessionalService",
      description: "Tentativa não permitida de desvincular serviço de profissional.",
    })
    return errorResponse("Você não tem permissão para gerenciar serviços vinculados.", 403)
  }

  const link = await prisma.professionalService.findUnique({
    where: { professionalId_serviceId: { professionalId: professional.id, serviceId: service.id } },
    select: { id: true },
  })
  if (!link) {
    return errorResponse("Vínculo não encontrado.", 404)
  }

  try {
    await prisma.professionalService.delete({ where: { id: link.id } })

    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.PROFESSIONAL_SERVICE_UNLINKED,
      entity: "ProfessionalService",
      entityId: link.id,
      description: `Serviço ${service.name} foi desvinculado do profissional ${professional.name}.`,
    })

    return successResponse({ id: link.id })
  } catch (error) {
    return errorResponse("Não foi possível remover o vínculo.", 500, {
      code: "INTERNAL_ERROR",
      logContext: "professionals.services.unlink",
      logError: error,
      logMetadata: { clinicId: auth.user.clinicId, professionalId: professional.id, serviceId: service.id },
    })
  }
}
