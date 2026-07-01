import { prisma } from "@/lib/prisma"
import { requireApiUser } from "@/lib/api-auth"
import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"
import { successResponse, errorResponse } from "@/lib/api-response"
import { patientFormSchema } from "@/lib/validators/patient"
import { canCreatePatient } from "@/lib/permissions"

export async function POST(request: Request) {
  const auth = await requireApiUser()
  if (!auth.ok) {
    return errorResponse(auth.message, auth.status)
  }

  if (!canCreatePatient(auth.user.role)) {
    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.PATIENT_ACCESS_DENIED,
      entity: "Patient",
      description: "Tentativa não permitida de cadastrar paciente.",
    })
    return errorResponse("Você não tem permissão para cadastrar pacientes.", 403)
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
    // Always created under the logged-in user's own clinicId — the client
    // never supplies (or controls) which clinic a patient belongs to.
    const patient = await prisma.patient.create({
      data: {
        clinicId: auth.user.clinicId,
        name,
        phone,
        email: email ?? null,
        document: document ?? null,
        source: source ?? null,
        notes: notes ?? null,
        birthDate: birthDate ? new Date(birthDate) : null,
        status: "ACTIVE",
      },
      select: { id: true, name: true },
    })

    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.PATIENT_CREATED,
      entity: "Patient",
      entityId: patient.id,
      description: `Paciente ${patient.name} foi cadastrado.`,
    })

    return successResponse({ id: patient.id }, 201)
  } catch (error) {
    return errorResponse("Não foi possível cadastrar o paciente.", 500, {
      code: "INTERNAL_ERROR",
      logContext: "patients.create",
      logError: error,
      logMetadata: { clinicId: auth.user.clinicId },
    })
  }
}
