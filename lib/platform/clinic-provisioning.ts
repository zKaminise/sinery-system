import "server-only"

import { prisma } from "@/lib/prisma"
import { hashPassword, generateProvisionalPassword } from "@/lib/password"
import { slugify, validateSlug } from "@/lib/platform/slug"
import { createPlatformAuditLog, PlatformAuditAction } from "@/lib/platform/platform-audit"

/**
 * Shared clinic provisioning (Prompt 22). ONE transactional service used by BOTH
 * the founder manual creation AND the Asaas checkout webhook, so both paths
 * create the exact same set of records. Callers send the welcome email
 * afterwards (different template per source).
 */

export type ProvisioningSource = "FOUNDER_MANUAL" | "ASAAS_CHECKOUT"
type SegmentValue = "ODONTOLOGY" | "PHYSIOTHERAPY" | "AESTHETICS" | "PSYCHOLOGY" | "MEDICAL" | "OTHER"
type SubStatus = "FREE" | "TRIALING" | "ACTIVE" | "EXEMPT"
type BillingTypeValue = "MANUAL" | "CHECKOUT" | "API" | "EXTERNAL"
type PaymentMethodValue = "MANUAL" | "PIX" | "BOLETO" | "CREDIT_CARD" | "BANK_TRANSFER" | "FREE" | "OTHER"

export interface ProvisionClinicInput {
  source: ProvisioningSource
  clinicName: string
  slug: string
  segment?: SegmentValue
  clinicEmail?: string
  phone?: string
  whatsapp?: string
  city?: string
  state?: string

  ownerName: string
  ownerEmail: string
  ownerPassword?: string

  planId?: string | null
  subscription: {
    status: SubStatus | "PAST_DUE"
    billingType: BillingTypeValue
    paymentMethod?: PaymentMethodValue
    amountInCents: number
    trialEndsAt?: Date | null
    currentPeriodStart?: Date | null
    nextDueDate?: Date | null
    graceDays: number
    internalNotes?: string
    freeReason?: string
    externalProvider?: string
    externalSubscriptionId?: string
  }
  firstInvoice?: {
    amountInCents: number
    dueDate: Date
    status: "PENDING" | "PAID"
    paidAt?: Date | null
    paymentMethod?: PaymentMethodValue
    externalPaymentId?: string
  } | null
  checkoutSessionId?: string | null
  /** For audit attribution (founder id); null for checkout (system). */
  platformUserId?: string | null
}

export interface ProvisionClinicResult {
  ok: boolean
  error?: string
  data?: {
    clinicId: string
    ownerId: string
    ownerName: string
    ownerEmail: string
    provisionalPassword: string
    clinicName: string
    slug: string
    url: string
    subscriptionId: string
    subscriptionStatus: string
    nextDueDate: string | null
    invoiceId: string | null
    planName: string | null
  }
}

/** Informational tenant URL for the welcome email / success screen. */
export function clinicAppUrl(slug: string): string {
  const root = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "").trim()
  if (root && !root.includes("localhost")) return `https://${slug}.app.${root}`
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
}

export async function provisionClinic(input: ProvisionClinicInput): Promise<ProvisionClinicResult> {
  const slug = slugify(input.slug)
  const slugCheck = validateSlug(slug)
  if (!slugCheck.ok) return { ok: false, error: slugCheck.error }

  const existing = await prisma.clinic.findUnique({ where: { slug }, select: { id: true } })
  if (existing) return { ok: false, error: `Já existe uma clínica com o slug "${slug}".` }

  const plainPassword = input.ownerPassword?.trim() || generateProvisionalPassword()
  const passwordHash = await hashPassword(plainPassword)

  try {
    const result = await prisma.$transaction(async (tx) => {
      const clinic = await tx.clinic.create({
        data: {
          name: input.clinicName,
          slug,
          segment: input.segment ?? "ODONTOLOGY",
          email: input.clinicEmail,
          phone: input.phone,
          whatsapp: input.whatsapp,
          city: input.city,
          state: input.state,
          status: "ACTIVE",
        },
      })
      await tx.clinicSettings.create({ data: { clinicId: clinic.id } })
      await tx.aiSettings.create({ data: { clinicId: clinic.id } })
      await tx.whatsAppIntegration.create({ data: { clinicId: clinic.id, webhookPath: "/api/webhooks/whatsapp" } })

      const owner = await tx.user.create({
        data: {
          clinicId: clinic.id,
          name: input.ownerName,
          email: input.ownerEmail.trim().toLowerCase(),
          passwordHash,
          role: "OWNER",
          status: "ACTIVE",
          temporaryPassword: true,
        },
      })

      const subscription = await tx.clinicSubscription.create({
        data: {
          clinicId: clinic.id,
          planId: input.planId ?? null,
          status: input.subscription.status,
          billingType: input.subscription.billingType,
          paymentMethod: input.subscription.paymentMethod ?? "MANUAL",
          amountInCents: input.subscription.amountInCents,
          currency: "BRL",
          trialEndsAt: input.subscription.trialEndsAt ?? null,
          currentPeriodStart: input.subscription.currentPeriodStart ?? new Date(),
          nextDueDate: input.subscription.nextDueDate ?? null,
          graceDays: input.subscription.graceDays,
          internalNotes: input.subscription.internalNotes,
          freeReason: input.subscription.freeReason,
        },
      })

      let invoice = null
      if (input.firstInvoice) {
        invoice = await tx.billingInvoice.create({
          data: {
            clinicId: clinic.id,
            subscriptionId: subscription.id,
            status: input.firstInvoice.status,
            paymentMethod: input.firstInvoice.paymentMethod ?? "MANUAL",
            amountInCents: input.firstInvoice.amountInCents,
            currency: "BRL",
            dueDate: input.firstInvoice.dueDate,
            paidAt: input.firstInvoice.paidAt ?? null,
            externalProvider: input.subscription.externalProvider,
            externalInvoiceId: input.firstInvoice.externalPaymentId,
            internalNotes: input.source === "ASAAS_CHECKOUT" ? "Fatura criada no checkout." : "Fatura inicial criada na criação da clínica.",
          },
        })
      }

      await tx.billingEvent.create({
        data: {
          clinicId: clinic.id,
          subscriptionId: subscription.id,
          invoiceId: invoice?.id,
          type: "CLINIC_CREATED",
          message: input.source === "ASAAS_CHECKOUT" ? "Clínica provisionada via checkout (Asaas)." : "Clínica criada pelo founder.",
          createdByPlatformUserId: input.platformUserId ?? null,
        },
      })

      if (input.checkoutSessionId) {
        await tx.checkoutSession.update({
          where: { id: input.checkoutSessionId },
          data: { clinicId: clinic.id, status: "PROVISIONED", paidAt: new Date() },
        })
      }

      return { clinic, owner, subscription, invoice }
    })

    // Audits (outside the tx).
    await createPlatformAuditLog({ platformUserId: input.platformUserId ?? null, action: PlatformAuditAction.CLINIC_CREATED, targetType: "Clinic", targetId: result.clinic.id, metadata: { slug, source: input.source } })
    await createPlatformAuditLog({ platformUserId: input.platformUserId ?? null, action: PlatformAuditAction.OWNER_CREATED, targetType: "User", targetId: result.owner.id, metadata: { clinicId: result.clinic.id } })
    await createPlatformAuditLog({ platformUserId: input.platformUserId ?? null, action: PlatformAuditAction.SUBSCRIPTION_CREATED, targetType: "ClinicSubscription", targetId: result.subscription.id, metadata: { clinicId: result.clinic.id, status: input.subscription.status } })
    if (result.invoice) {
      await createPlatformAuditLog({ platformUserId: input.platformUserId ?? null, action: PlatformAuditAction.INVOICE_CREATED, targetType: "BillingInvoice", targetId: result.invoice.id, metadata: { clinicId: result.clinic.id } })
    }

    const plan = input.planId ? await prisma.plan.findUnique({ where: { id: input.planId }, select: { name: true } }) : null

    return {
      ok: true,
      data: {
        clinicId: result.clinic.id,
        ownerId: result.owner.id,
        ownerName: result.owner.name,
        ownerEmail: result.owner.email,
        provisionalPassword: plainPassword,
        clinicName: result.clinic.name,
        slug,
        url: clinicAppUrl(slug),
        subscriptionId: result.subscription.id,
        subscriptionStatus: input.subscription.status,
        nextDueDate: input.subscription.nextDueDate ? input.subscription.nextDueDate.toISOString().slice(0, 10) : null,
        invoiceId: result.invoice?.id ?? null,
        planName: plan?.name ?? null,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : ""
    return { ok: false, error: message.includes("Unique") ? "Slug ou e-mail já em uso." : "Não foi possível provisionar a clínica." }
  }
}
