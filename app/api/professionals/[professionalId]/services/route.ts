import { prisma } from "@/lib/prisma"
import { requireApiUser } from "@/lib/api-auth"
import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"
import { successResponse, errorResponse } from "@/lib/api-response"
import { linkProfessionalServiceSchema } from "@/lib/validators/professional-service"
import { canManageProfessionalServices } from "@/lib/permissions"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ professionalId: string }> }
) {
  const auth = await requireApiUser()
  if (!auth.ok) {
    return errorResponse(auth.message, auth.status)
  }

  const { professionalId } = await params

  const professional = await prisma.professional.findFirst({
    where: { id: professionalId, clinicId: auth.user.clinicId },
    select: { id: true, name: true },
  })
  if (!professional) {
    return errorResponse("Profissional não encontrado.", 404)
  }

  if (!canManageProfessionalServices(auth.user.role)) {
    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.PROFESSIONAL_ACCESS_DENIED,
      entity: "ProfessionalService",
      entityId: professional.id,
      description: "Tentativa não permitida de vincular serviço a profissional.",
    })
    return errorResponse("Você não tem permissão para gerenciar serviços vinculados.", 403)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse("Requisição inválida.", 400)
  }

  const parsed = linkProfessionalServiceSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "Dados inválidos.", 422)
  }

  // Never trust a serviceId from the client without confirming it belongs to
  // this same clinic — otherwise a service from another clinic could be
  // linked to this professional.
  const service = await prisma.service.findFirst({
    where: { id: parsed.data.serviceId, clinicId: auth.user.clinicId },
    select: { id: true, name: true },
  })
  if (!service) {
    return errorResponse("Serviço não encontrado.", 404)
  }

  const existingLink = await prisma.professionalService.findUnique({
    where: { professionalId_serviceId: { professionalId: professional.id, serviceId: service.id } },
    select: { id: true },
  })
  if (existingLink) {
    return errorResponse("Este serviço já está vinculado a este profissional.", 409, {
      code: "CONFLICT",
    })
  }

  try {
    const link = await prisma.professionalService.create({
      data: {
        clinicId: auth.user.clinicId,
        professionalId: professional.id,
        serviceId: service.id,
      },
      select: { id: true },
    })

    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.PROFESSIONAL_SERVICE_LINKED,
      entity: "ProfessionalService",
      entityId: link.id,
      description: `Serviço ${service.name} foi vinculado ao profissional ${professional.name}.`,
    })

    return successResponse({ id: link.id }, 201)
  } catch (error) {
    return errorResponse("Não foi possível vincular o serviço.", 500, {
      code: "INTERNAL_ERROR",
      logContext: "professionals.services.link",
      logError: error,
      logMetadata: { clinicId: auth.user.clinicId, professionalId: professional.id },
    })
  }
}
