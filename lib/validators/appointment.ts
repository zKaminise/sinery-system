import { z } from "zod"

export const appointmentStatuses = [
  "SCHEDULED",
  "CONFIRMED",
  "CANCELLED",
  "RESCHEDULED",
  "COMPLETED",
  "NO_SHOW",
] as const

export const appointmentViews = ["day", "week", "list"] as const

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

const optionalNotes = z
  .string()
  .trim()
  .max(2000, { error: "Máximo de 2000 caracteres." })
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined))

// Create/update share the same shape: the form always submits the full
// appointment (patient, professional, optional service, date + start/end
// wall-clock times, notes). Times are validated as HH:mm strings here; the
// server converts them to UTC instants using the clinic timezone.
export const appointmentFormSchema = z
  .object({
    patientId: z.string({ error: "Selecione um paciente." }).min(1, { error: "Selecione um paciente." }),
    professionalId: z
      .string({ error: "Selecione um profissional." })
      .min(1, { error: "Selecione um profissional." }),
    serviceId: z
      .string()
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined)),
    date: z.string({ error: "Informe a data." }).regex(DATE_PATTERN, { error: "Data inválida." }),
    startTime: z
      .string({ error: "Informe o horário de início." })
      .regex(TIME_PATTERN, { error: "Horário inválido. Use o formato HH:mm." }),
    endTime: z
      .string({ error: "Informe o horário de término." })
      .regex(TIME_PATTERN, { error: "Horário inválido. Use o formato HH:mm." }),
    notes: optionalNotes,
  })
  .refine((data) => data.startTime < data.endTime, {
    error: "O horário de início deve ser menor que o horário de término.",
    path: ["endTime"],
  })
export type AppointmentFormInput = z.infer<typeof appointmentFormSchema>

// Status changes carry only the target status plus optional notes (e.g. a
// cancellation reason appended to the appointment's notes).
export const updateAppointmentStatusSchema = z.object({
  status: z.enum(appointmentStatuses, { error: "Status inválido." }),
  notes: optionalNotes,
})
export type UpdateAppointmentStatusInput = z.infer<typeof updateAppointmentStatusSchema>

export const appointmentFiltersSchema = z.object({
  view: z.enum(appointmentViews).default("day"),
  date: z.string().regex(DATE_PATTERN).optional(),
  professionalId: z.string().optional(),
  status: z.enum(appointmentStatuses).optional(),
  q: z.string().optional(),
  page: z.number().int().positive().optional(),
})
