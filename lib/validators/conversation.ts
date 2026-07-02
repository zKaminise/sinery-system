import { z } from "zod"

export const conversationStatusValues = [
  "AI_HANDLING",
  "WAITING_HUMAN",
  "HUMAN_HANDLING",
  "CLOSED",
] as const

export const conversationChannelValues = ["WHATSAPP", "INTERNAL_SIMULATOR"] as const

export const conversationActionValues = [
  "take",
  "transfer",
  "return_to_ai",
  "close",
  "reopen",
  "assign",
] as const

const messageContent = z
  .string({ error: "Digite uma mensagem." })
  .trim()
  .min(1, { error: "Digite uma mensagem." })
  .max(2000, { error: "Máximo de 2000 caracteres." })

const optionalId = z
  .string()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined))

// Create a test (INTERNAL_SIMULATOR) conversation. Either a patient is chosen
// (name/phone come from the patient record) OR contactName + contactPhone are
// provided manually. An initial patient message is always required.
export const createConversationSchema = z
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
    initialMessage: messageContent,
    status: z.enum(conversationStatusValues).default("WAITING_HUMAN"),
  })
  .refine((data) => Boolean(data.patientId) || Boolean(data.contactName), {
    error: "Informe um paciente ou o nome do contato.",
    path: ["contactName"],
  })
  .refine((data) => Boolean(data.patientId) || Boolean(data.contactPhone), {
    error: "Informe um paciente ou o telefone do contato.",
    path: ["contactPhone"],
  })
export type CreateConversationInput = z.infer<typeof createConversationSchema>

export const sendMessageSchema = z.object({
  content: messageContent,
})
export type SendMessageInput = z.infer<typeof sendMessageSchema>

// A single action endpoint drives all status changes. `assignedUserId` is only
// required for the "assign" action; the server still re-validates that the
// user belongs to the current clinic.
export const conversationActionSchema = z
  .object({
    action: z.enum(conversationActionValues, { error: "Ação inválida." }),
    assignedUserId: optionalId,
  })
  .refine((data) => data.action !== "assign" || Boolean(data.assignedUserId), {
    error: "Selecione um responsável.",
    path: ["assignedUserId"],
  })
export type ConversationActionInput = z.infer<typeof conversationActionSchema>

export const conversationFiltersSchema = z.object({
  q: z.string().optional(),
  status: z.enum(conversationStatusValues).optional(),
  channel: z.enum(conversationChannelValues).optional(),
  assignedUserId: z.string().optional(),
  page: z.number().int().positive().optional(),
})
