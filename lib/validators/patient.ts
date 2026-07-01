import { z } from "zod"

export const patientStatuses = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const

export const patientSources = [
  "WhatsApp",
  "Instagram",
  "Indicação",
  "Google",
  "Site",
  "Retorno",
  "Outro",
] as const

// Turns "" into undefined so optional text fields clear cleanly.
function optionalString(max: number) {
  return z
    .string()
    .trim()
    .max(max, { error: `Máximo de ${max} caracteres.` })
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined))
}

/**
 * Keeps only digits. Applied to `phone` so stored values are consistent
 * regardless of how the user formats them on input (spaces, dashes, +55...).
 */
function normalizePhone(value: string): string {
  return value.replace(/\D/g, "")
}

/**
 * Shared shape for both create and update — the patient form always submits
 * the full record (not a partial patch), so update/create use the same
 * schema. `status` is intentionally excluded: it's changed only via the
 * dedicated status endpoint, never through this form.
 */
export const patientFormSchema = z.object({
  name: z
    .string({ error: "Informe o nome do paciente." })
    .trim()
    .min(2, { error: "O nome deve ter pelo menos 2 caracteres." })
    .max(160),
  phone: z
    .string({ error: "Informe o telefone." })
    .trim()
    .min(8, { error: "Informe um telefone válido." })
    .max(30)
    .transform(normalizePhone)
    .refine((v) => v.length >= 8, { error: "Informe um telefone válido." }),
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
  document: optionalString(30),
  // Raw "YYYY-MM-DD" from an <input type="date">. Converted to a Date only
  // at the API layer, keeping this schema free of Date-parsing edge cases.
  birthDate: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined))
    .refine((v) => v === undefined || !Number.isNaN(Date.parse(v)), {
      error: "Data de nascimento inválida.",
    }),
  source: optionalString(60),
  notes: optionalString(2000),
})
export type PatientFormInput = z.infer<typeof patientFormSchema>

export const patientStatusSchema = z.object({
  status: z.enum(patientStatuses, { error: "Status inválido." }),
})
export type PatientStatusInput = z.infer<typeof patientStatusSchema>
