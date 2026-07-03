import { z } from "zod"

const optionalId = z
  .string()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined))

const patientMessage = z
  .string({ error: "Digite uma mensagem." })
  .trim()
  .min(1, { error: "Digite uma mensagem." })
  .max(2000, { error: "Máximo de 2000 caracteres." })

// Create a simulation: optionally tie to a patient, else provide a fake
// name/phone. An initial patient message is required to kick off the flow.
export const createAssistSimulationSchema = z
  .object({
    patientId: optionalId,
    contactName: z
      .string()
      .trim()
      .max(120, { error: "Máximo de 120 caracteres." })
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined)),
    contactPhone: z
      .string()
      .trim()
      .max(30, { error: "Máximo de 30 caracteres." })
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined)),
    initialMessage: patientMessage,
  })
  .refine((data) => Boolean(data.patientId) || Boolean(data.contactName), {
    error: "Informe um paciente ou o nome do contato.",
    path: ["contactName"],
  })
export type CreateAssistSimulationInput = z.infer<typeof createAssistSimulationSchema>

export const sendAssistSimulatorMessageSchema = z.object({
  content: patientMessage,
})
export type SendAssistSimulatorMessageInput = z.infer<typeof sendAssistSimulatorMessageSchema>

export const aiToneValues = ["professional", "friendly", "casual"] as const

export const updateAiSettingsSchema = z.object({
  assistantName: z
    .string({ error: "Informe o nome da assistente." })
    .trim()
    .min(1, { error: "Informe o nome da assistente." })
    .max(60, { error: "Máximo de 60 caracteres." }),
  enabled: z.boolean(),
  tone: z.enum(aiToneValues, { error: "Tom inválido." }),
  fallbackToHuman: z.boolean(),
  humanFallbackMessage: z
    .string()
    .trim()
    .max(500, { error: "Máximo de 500 caracteres." })
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  canAnswerPricing: z.boolean(),
  canSchedule: z.boolean(),
  canReschedule: z.boolean(),
  canCancel: z.boolean(),
})
export type UpdateAiSettingsInput = z.infer<typeof updateAiSettingsSchema>

const knowledgeTitle = z
  .string({ error: "Informe o título." })
  .trim()
  .min(1, { error: "Informe o título." })
  .max(120, { error: "Máximo de 120 caracteres." })

const knowledgeContent = z
  .string({ error: "Informe o conteúdo." })
  .trim()
  .min(1, { error: "Informe o conteúdo." })
  .max(4000, { error: "Máximo de 4000 caracteres." })

export const createKnowledgeBaseSchema = z.object({
  title: knowledgeTitle,
  content: knowledgeContent,
})
export type CreateKnowledgeBaseInput = z.infer<typeof createKnowledgeBaseSchema>

export const updateKnowledgeBaseSchema = z.object({
  title: knowledgeTitle,
  content: knowledgeContent,
})
export type UpdateKnowledgeBaseInput = z.infer<typeof updateKnowledgeBaseSchema>

export const updateKnowledgeBaseStatusSchema = z.object({
  active: z.boolean(),
})
export type UpdateKnowledgeBaseStatusInput = z.infer<typeof updateKnowledgeBaseStatusSchema>
