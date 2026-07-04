import { z } from "zod"

const optional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))

/**
 * Public checkout input (from the marketing site). Deliberately has NO price,
 * amount, clinicId, or planId — only a planSlug. The price ALWAYS comes from the
 * Plan row on the server.
 */
export const startCheckoutSchema = z.object({
  planSlug: z.string().trim().min(1, { error: "Informe o plano." }),
  clinicName: z.string().trim().min(2, { error: "Informe o nome da clínica." }).max(120),
  desiredSlug: z.string().trim().min(3, { error: "Informe o slug desejado." }).max(40),
  ownerName: z.string().trim().min(2, { error: "Informe o nome do responsável." }).max(120),
  ownerEmail: z.email({ error: "Informe um e-mail válido." }),
  ownerPhone: optional,
  companyDocument: optional,
  city: optional,
  state: optional,
})
export type StartCheckoutInput = z.infer<typeof startCheckoutSchema>
