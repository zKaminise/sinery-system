import { z } from "zod"

/** Intents the AI may return (mirrors the rule-based simulator's set). */
export const aiIntentValues = [
  "SCHEDULE_APPOINTMENT",
  "RESCHEDULE_APPOINTMENT",
  "CANCEL_APPOINTMENT",
  "CONFIRM_APPOINTMENT",
  "ASK_SERVICES",
  "ASK_ADDRESS",
  "ASK_HOURS",
  "ASK_PRICE",
  "HUMAN_HELP",
  "EMERGENCY_OR_SENSITIVE",
  "UNKNOWN",
] as const

/** Tools the AI is allowed to request (the executor enforces the allow-list). */
export const aiToolNames = [
  "getClinicInfo",
  "listActiveServices",
  "findAvailableSlots",
  "createAppointment",
  "findPatientUpcomingAppointments",
  "cancelAppointment",
  "confirmAppointment",
  "rescheduleAppointment",
  "transferToHuman",
  "answerFromKnowledgeBase",
] as const
export type AiToolName = (typeof aiToolNames)[number]

/** The validated structured output the model must return. */
export const aiStructuredOutputSchema = z.object({
  reply: z.string().max(2000).default(""),
  intent: z.enum(aiIntentValues).default("UNKNOWN"),
  confidence: z.number().min(0).max(1).default(0),
  shouldTransferToHuman: z.boolean().default(false),
  requestedTool: z
    .object({
      name: z.enum(aiToolNames),
      arguments: z.record(z.string(), z.unknown()).default({}),
    })
    .nullable()
    .default(null),
})
export type AiStructuredOutput = z.infer<typeof aiStructuredOutputSchema>

/** Below this confidence, the assistant transfers to a human. */
export const MIN_CONFIDENCE = 0.65

// --- Tool argument schemas (validated by the executor) ---------------------

export const toolArgSchemas = {
  getClinicInfo: z.object({}).loose(),
  listActiveServices: z.object({}).loose(),
  findAvailableSlots: z.object({
    serviceId: z.string().optional(),
    serviceName: z.string().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
    limit: z.number().int().positive().max(5).optional(),
  }),
  createAppointment: z.object({
    patientId: z.string().min(1),
    professionalId: z.string().min(1),
    serviceId: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  }),
  findPatientUpcomingAppointments: z.object({
    patientId: z.string().optional(),
  }),
  cancelAppointment: z.object({ appointmentId: z.string().min(1) }),
  confirmAppointment: z.object({ appointmentId: z.string().min(1) }),
  rescheduleAppointment: z.object({
    appointmentId: z.string().min(1),
    professionalId: z.string().min(1),
    serviceId: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  }),
  transferToHuman: z.object({ reason: z.string().max(200).optional() }),
  answerFromKnowledgeBase: z.object({ query: z.string().max(200).optional() }),
} as const
