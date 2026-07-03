import { z } from "zod"

/**
 * Editable-in-DB fields only. Secrets are NEVER accepted here — they live in
 * env. `provider` is fixed to META_CLOUD_API for now.
 */
export const updateWhatsAppIntegrationSchema = z.object({
  enabled: z.boolean().optional(),
  displayPhoneNumber: z
    .string()
    .trim()
    .max(40, "Número muito longo.")
    .nullish()
    .transform((v) => (v && v.length > 0 ? v : null)),
  verifiedName: z
    .string()
    .trim()
    .max(120, "Nome muito longo.")
    .nullish()
    .transform((v) => (v && v.length > 0 ? v : null)),
})

export type UpdateWhatsAppIntegrationInput = z.infer<typeof updateWhatsAppIntegrationSchema>
