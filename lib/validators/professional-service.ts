import { z } from "zod"

export const linkProfessionalServiceSchema = z.object({
  serviceId: z.string({ error: "Selecione um serviço." }).min(1, { error: "Selecione um serviço." }),
})
export type LinkProfessionalServiceInput = z.infer<typeof linkProfessionalServiceSchema>

// No body needed to unlink — the serviceId is always a path param. Kept for
// a consistent, documented contract alongside the link schema above.
export const unlinkProfessionalServiceSchema = z.object({}).optional()
