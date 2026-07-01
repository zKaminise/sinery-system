import { prisma } from "@/lib/prisma"
import { requireApiUser } from "@/lib/api-auth"
import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"
import { successResponse, errorResponse } from "@/lib/api-response"
import { patientFormSchema } from "@/lib/validators/patient"
import { canEditPatient } from "@/lib/permissions"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ patientId: string }> }
) {
  const auth = await requireApiUser()
  if (!auth.ok) {
    return errorResponse(auth.message, auth.status)
  }

  const { patientId } = await params

  // Tenant guard: the patient must belong to the logged-in user's clinic.
  // Looking up by id alone (without clinicId) would let a user reach another
  // clinic's record by guessing/enumerating ids — never do that.
  const target = await prisma.patient.findFirst({
    where: { id: patientId, clinicId: auth.user.clinicId },
    select: { id: true, name: true },
  })
  if (!target) {
    return errorResponse("Paciente não encontrado.", 404)
  }

  if (!canEditPatient(auth.user.role)) {
    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.PATIENT_ACCESS_DENIED,
      entity: "Patient",
      entityId: target.id,
      description: "Tentativa não permitida de editar paciente.",
    })
    return errorResponse("Você não tem permissão para editar pacientes.", 403)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse("Requisição inválida.", 400)
  }

  const parsed = patientFormSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "Dados inválidos.", 422)
  }

  const { name, phone, email, document, source, notes, birthDate } = parsed.data

  try {
    const updated = await prisma.patient.update({
      where: { id: target.id },
      data: {
        name,
        phone,
        email: email ?? null,
        document: document ?? null,
        source: source ?? null,
        notes: notes ?? null,
        birthDate: birthDate ? new Date(birthDate) : null,
      },
      select: { id: true, name: true },
    })

    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.PATIENT_UPDATED,
      entity: "Patient",
      entityId: updated.id,
      description: `Dados do paciente ${updated.name} foram atualizados.`,
    })

    return successResponse({ id: updated.id })
  } catch (error) {
    return errorResponse("Não foi possível atualizar o paciente.", 500, {
      code: "INTERNAL_ERROR",
      logContext: "patients.update",
      logError: error,
      logMetadata: { clinicId: auth.user.clinicId, patientId: target.id },
    })
  }
}
