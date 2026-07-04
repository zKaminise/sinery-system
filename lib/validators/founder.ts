import { z } from "zod"

/** Commercial "type" chosen in the founder UI, mapped to subscription fields. */
export const SUBSCRIPTION_TYPES = [
  "free",
  "trial",
  "monthly",
  "yearly",
  "founder_deal",
  "exempt",
  "custom",
] as const
export type SubscriptionTypeValue = (typeof SUBSCRIPTION_TYPES)[number]

const optionalTrimmed = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))

export const createClinicSchema = z.object({
  // Clinic
  name: z.string().trim().min(2, { error: "Informe o nome da clínica." }).max(120),
  slug: z.string().trim().min(3, { error: "Informe o slug/subdomínio." }).max(40),
  segment: z.enum(["ODONTOLOGY", "PHYSIOTHERAPY", "AESTHETICS", "PSYCHOLOGY", "MEDICAL", "OTHER"]).default("ODONTOLOGY"),
  email: z.union([z.email(), z.literal("")]).optional().transform((v) => (v ? v : undefined)),
  phone: optionalTrimmed,
  whatsapp: optionalTrimmed,
  city: optionalTrimmed,
  state: optionalTrimmed,

  // Owner
  ownerName: z.string().trim().min(2, { error: "Informe o nome do responsável." }).max(120),
  ownerEmail: z.email({ error: "Informe um e-mail válido para o responsável." }),
  ownerPassword: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : undefined)),

  // Commercial
  subscriptionType: z.enum(SUBSCRIPTION_TYPES).default("trial"),
  planId: optionalTrimmed,
  amountInReais: z.coerce.number().min(0).default(0),
  startDate: optionalTrimmed, // "YYYY-MM-DD"
  nextDueDate: optionalTrimmed, // "YYYY-MM-DD"
  trialDays: z.coerce.number().int().min(0).max(365).default(14),
  graceDays: z.coerce.number().int().min(0).max(120).default(20),
  internalNotes: optionalTrimmed,
})
export type CreateClinicInput = z.infer<typeof createClinicSchema>

export const createInvoiceSchema = z.object({
  amountInReais: z.coerce.number().min(0),
  dueDate: z.string().trim().min(1, { error: "Informe o vencimento." }), // "YYYY-MM-DD"
  paymentMethod: z.enum(["MANUAL", "PIX", "BOLETO", "CREDIT_CARD", "BANK_TRANSFER", "FREE", "OTHER"]).default("MANUAL"),
  internalNotes: optionalTrimmed,
})
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>

export const invoiceActionSchema = z.object({
  action: z.enum(["mark_paid", "mark_overdue", "cancel"]),
  paymentMethod: z.enum(["MANUAL", "PIX", "BOLETO", "CREDIT_CARD", "BANK_TRANSFER", "FREE", "OTHER"]).optional(),
  manualPaymentReference: optionalTrimmed,
})
export type InvoiceActionInput = z.infer<typeof invoiceActionSchema>

export const clinicStatusActionSchema = z.object({
  action: z.enum(["suspend", "reactivate", "recalculate"]),
  reason: optionalTrimmed,
})
export type ClinicStatusActionInput = z.infer<typeof clinicStatusActionSchema>

export const planSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().min(2).max(60),
  description: optionalTrimmed,
  priceInReais: z.coerce.number().min(0).default(0),
  billingInterval: z.enum(["FREE", "MONTHLY", "YEARLY", "ONE_TIME", "CUSTOM"]).default("MONTHLY"),
  includesAi: z.coerce.boolean().default(false),
  includesWhatsapp: z.coerce.boolean().default(false),
  active: z.coerce.boolean().default(true),
})
export type PlanInput = z.infer<typeof planSchema>
