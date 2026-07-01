import { z } from "zod"

export const clinicSegments = [
  "ODONTOLOGY",
  "PHYSIOTHERAPY",
  "AESTHETICS",
  "PSYCHOLOGY",
  "MEDICAL",
  "OTHER",
] as const

export const userRoles = ["OWNER", "ADMIN", "RECEPTIONIST", "PROFESSIONAL"] as const

export const userStatuses = ["ACTIVE", "INACTIVE"] as const

export const aiTones = ["professional", "friendly", "formal"] as const

export const appointmentSlots = [15, 30, 45, 60] as const

// Turns "" into undefined so optional text fields clear cleanly.
const optionalString = z
  .string()
  .trim()
  .max(200, { error: "Máximo de 200 caracteres." })
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined))

export const updateClinicSchema = z.object({
  name: z
    .string({ error: "Informe o nome da clínica." })
    .trim()
    .min(2, { error: "O nome deve ter pelo menos 2 caracteres." })
    .max(120, { error: "Máximo de 120 caracteres." }),
  legalName: optionalString,
  document: optionalString,
  segment: z.enum(clinicSegments, { error: "Selecione um segmento válido." }),
  email: z
    .string()
    .trim()
    .max(160)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined))
    .refine((v) => v === undefined || z.email().safeParse(v).success, {
      error: "Informe um e-mail válido.",
    }),
  phone: optionalString,
  whatsapp: optionalString,
  address: optionalString,
  city: optionalString,
  state: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  logoUrl: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined))
    .refine((v) => v === undefined || z.url().safeParse(v).success, {
      error: "Informe uma URL válida.",
    }),
})
export type UpdateClinicInput = z.infer<typeof updateClinicSchema>

export const updateClinicSettingsSchema = z
  .object({
    timezone: z
      .string()
      .trim()
      .min(1, { error: "Informe o fuso horário." })
      .max(60),
    businessStartHour: z
      .number({ error: "Informe o horário de início." })
      .int()
      .min(0, { error: "Horário inválido." })
      .max(23, { error: "Horário inválido." }),
    businessEndHour: z
      .number({ error: "Informe o horário de término." })
      .int()
      .min(0, { error: "Horário inválido." })
      .max(23, { error: "Horário inválido." }),
    appointmentSlotMinutes: z
      .number({ error: "Informe o intervalo de agendamento." })
      .int()
      .positive({ error: "O intervalo deve ser positivo." }),
    allowAiScheduling: z.boolean(),
    allowAiRescheduling: z.boolean(),
    allowAiCancellation: z.boolean(),
    aiTone: z.enum(aiTones, { error: "Selecione um tom válido." }),
  })
  .refine((data) => data.businessStartHour < data.businessEndHour, {
    error: "O horário de início deve ser menor que o de término.",
    path: ["businessEndHour"],
  })
export type UpdateClinicSettingsInput = z.infer<typeof updateClinicSettingsSchema>

export const createUserSchema = z.object({
  name: z
    .string({ error: "Informe o nome." })
    .trim()
    .min(2, { error: "O nome deve ter pelo menos 2 caracteres." })
    .max(120),
  email: z.email({ error: "Informe um e-mail válido." }).trim().toLowerCase(),
  role: z.enum(userRoles, { error: "Selecione uma função válida." }),
})
export type CreateUserInput = z.infer<typeof createUserSchema>

export const updateUserSchema = z.object({
  name: z
    .string({ error: "Informe o nome." })
    .trim()
    .min(2, { error: "O nome deve ter pelo menos 2 caracteres." })
    .max(120),
  role: z.enum(userRoles, { error: "Selecione uma função válida." }),
})
export type UpdateUserInput = z.infer<typeof updateUserSchema>

export const updateUserStatusSchema = z.object({
  status: z.enum(userStatuses, { error: "Status inválido." }),
})
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>

// Reset takes no body input (the server generates the new provisional
// password), but the schema exists for a consistent, future-proof contract.
export const resetUserPasswordSchema = z.object({}).optional()
