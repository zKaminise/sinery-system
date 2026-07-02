import { z } from "zod"

export const professionalStatuses = ["ACTIVE", "INACTIVE"] as const

function optionalString(max: number) {
  return z
    .string()
    .trim()
    .max(max, { error: `Máximo de ${max} caracteres.` })
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined))
}

/** Keeps only digits, mirroring the same normalization used for Patient.phone. */
function normalizePhone(value: string): string {
  return value.replace(/\D/g, "")
}

export const professionalFormSchema = z.object({
  name: z
    .string({ error: "Informe o nome do profissional." })
    .trim()
    .min(2, { error: "O nome deve ter pelo menos 2 caracteres." })
    .max(160),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(160)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined))
    .refine((v) => v === undefined || z.email().safeParse(v).success, {
      error: "Informe um e-mail válido.",
    }),
  phone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .transform((v) => (v && v.length > 0 ? normalizePhone(v) : undefined)),
  specialty: optionalString(120),
})
export type ProfessionalFormInput = z.infer<typeof professionalFormSchema>

export const professionalStatusSchema = z.object({
  status: z.enum(professionalStatuses, { error: "Status inválido." }),
})
export type ProfessionalStatusInput = z.infer<typeof professionalStatusSchema>
