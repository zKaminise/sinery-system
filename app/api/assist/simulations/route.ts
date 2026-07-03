import { prisma } from "@/lib/prisma"
import { requireApiUser } from "@/lib/api-auth"
import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"
import { successResponse, errorResponse } from "@/lib/api-response"
import { createAssistSimulationSchema } from "@/lib/validators/assist"
import { canUseAssistSimulator } from "@/lib/permissions"
import { processAssistMessage } from "@/lib/ai/assist-provider"

export async function POST(request: Request) {
  const auth = await requireApiUser()
  if (!auth.ok) {
    return errorResponse(auth.message, auth.status)
  }

  if (!canUseAssistSimulator(auth.user.role)) {
    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.ASSIST_ACCESS_DENIED,
      entity: "Conversation",
      description: "Tentativa não permitida de criar simulação da Assist.",
    })
    return errorResponse("Você não tem permissão para usar o simulador.", 403)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse("Requisição inválida.", 400)
  }

  const parsed = createAssistSimulationSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "Dados inválidos.", 422)
  }

  const { patientId, contactName, contactPhone, initialMessage } = parsed.data

  let resolvedName = contactName ?? null
  let resolvedPhone = contactPhone ?? null

  if (patientId) {
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, clinicId: auth.user.clinicId },
      select: { id: true, name: true, phone: true },
    })
    if (!patient) {
      return errorResponse("Paciente não encontrado ou não pertence à clínica atual.", 422)
    }
    resolvedName = patient.name
    resolvedPhone = patient.phone
  }

  try {
    const conversation = await prisma.conversation.create({
      data: {
        clinicId: auth.user.clinicId,
        patientId: patientId ?? null,
        channel: "INTERNAL_SIMULATOR",
        status: "AI_HANDLING",
        contactName: resolvedName,
        contactPhone: resolvedPhone,
      },
      select: { id: true },
    })

    await createAuditLog({
      clinicId: auth.user.clinicId,
      userId: auth.user.id,
      action: AuditAction.ASSIST_SIMULATION_CREATED,
      entity: "Conversation",
      entityId: conversation.id,
      description: `Simulação da Sinery Assist criada com ${resolvedName ?? "contato"}.`,
      metadata: { conversationId: conversation.id, patientId: patientId ?? null },
    })

    // Process the opening patient message so the assistant responds right away.
    await processAssistMessage({
      clinicId: auth.user.clinicId,
      conversationId: conversation.id,
      userId: auth.user.id,
      message: initialMessage,
    })

    return successResponse({ id: conversation.id }, 201)
  } catch (error) {
    return errorResponse("Não foi possível criar a simulação.", 500, {
      code: "INTERNAL_ERROR",
      logContext: "assist.simulation.create",
      logError: error,
      logMetadata: { clinicId: auth.user.clinicId },
    })
  }
}
