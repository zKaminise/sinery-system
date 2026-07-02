import { z } from "zod"

export const serviceStatuses = ["ACTIVE", "INACTIVE"] as const

export const suggestedDurations = [15, 30, 45, 60, 90, 120] as const

/**
 * Price is authored in the UI as reais (e.g. 150.00) and converted to
 * integer cents only at the API layer (`Math.round(priceInReais * 100)`),
 * matching Service.priceInCents in the schema. Keeping the form-facing unit
 * as reais avoids asking staff to mentally divide by 100.
 */
export const serviceFormSchema = z.object({
  name: z
    .string({ error: "Informe o nome do serviço." })
    .trim()
    .min(2, { error: "O nome deve ter pelo menos 2 caracteres." })
    .max(160),
  description: z
    .string()
    .trim()
    .max(1000, { error: "Máximo de 1000 caracteres." })
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  durationMinutes: z
    .number({ error: "Informe a duração em minutos." })
    .int({ error: "A duração deve ser um número inteiro de minutos." })
    .min(5, { error: "A duração mínima é de 5 minutos." })
    .max(480, { error: "A duração máxima é de 480 minutos." }),
  priceInReais: z
    .number()
    .nonnegative({ error: "O preço não pode ser negativo." })
    .optional(),
})
export type ServiceFormInput = z.infer<typeof serviceFormSchema>

export const serviceStatusSchema = z.object({
  status: z.enum(serviceStatuses, { error: "Status inválido." }),
})
export type ServiceStatusInput = z.infer<typeof serviceStatusSchema>
