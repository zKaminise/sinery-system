import "server-only"
import { randomBytes } from "node:crypto"

import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { slugify, validateSlug } from "@/lib/platform/slug"
import { getPublicCheckoutConfig } from "@/lib/asaas/asaas-config"
import { createAsaasCustomer, createAsaasSubscription } from "@/lib/asaas/asaas-client"
import { sanitizeAsaasError } from "@/lib/asaas/asaas-errors"
import { parseAsaasWebhook, isProvisioningEvent, isOverdueEvent, isCancellationEvent, asaasPayloadHash } from "@/lib/asaas/asaas-webhook"
import { billingIntervalToAsaasCycle, intervalAdvanceMonths, type BillingIntervalValue } from "@/lib/asaas/asaas-mappers"
import { provisionClinic, clinicAppUrl } from "@/lib/platform/clinic-provisioning"
import { sendTransactionalEmail } from "@/lib/email/email-service"
import { ownerWelcomeCheckoutEmail } from "@/lib/email/email-templates"
import { createPlatformAuditLog, PlatformAuditAction } from "@/lib/platform/platform-audit"

function newPublicId(): string {
  return randomBytes(12).toString("hex")
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setUTCMonth(d.getUTCMonth() + months)
  return d
}

// --- start public checkout -------------------------------------------------

export interface StartCheckoutResult {
  ok: boolean
  status?: number
  error?: string
  data?: {
    publicId: string
    status: string
    paymentUrl?: string
    expiresAt?: string
    plan: { name: string; amountInCents: number }
  }
}

export async function startPublicCheckout(input: {
  planSlug: string
  clinicName: string
  desiredSlug: string
  ownerName: string
  ownerEmail: string
  ownerPhone?: string
  companyDocument?: string
  city?: string
  state?: string
}): Promise<StartCheckoutResult> {
  const cfg = getPublicCheckoutConfig()
  if (!cfg.enabled) return { ok: false, status: 403, error: "Checkout público desabilitado." }

  const plan = await prisma.plan.findUnique({ where: { slug: input.planSlug } })
  if (!plan || !plan.active) return { ok: false, status: 400, error: "Plano inválido ou indisponível." }

  const cycle = billingIntervalToAsaasCycle(plan.billingInterval as BillingIntervalValue)
  if (!cycle) return { ok: false, status: 400, error: "Este plano não pode ser assinado por checkout." }

  const slug = slugify(input.desiredSlug)
  const slugCheck = validateSlug(slug)
  if (!slugCheck.ok) return { ok: false, status: 400, error: slugCheck.error }

  const existingClinic = await prisma.clinic.findUnique({ where: { slug }, select: { id: true } })
  if (existingClinic) return { ok: false, status: 409, error: "Este slug já está em uso." }

  const inflight = await prisma.checkoutSession.findFirst({
    where: { desiredSlug: slug, status: { in: ["AWAITING_PAYMENT", "PAID", "PROVISIONING"] } },
    select: { id: true },
  })
  if (inflight) return { ok: false, status: 409, error: "Este slug já está reservado por um checkout em andamento." }

  // Rate limit per owner email.
  const hourAgo = new Date(Date.now() - 3_600_000)
  const recent = await prisma.checkoutSession.count({ where: { ownerEmail: input.ownerEmail.toLowerCase(), createdAt: { gte: hourAgo } } })
  if (recent >= cfg.rateLimitPerHour) return { ok: false, status: 429, error: "Muitas tentativas. Tente novamente mais tarde." }

  // Price ALWAYS from the Plan — never from the request.
  const amountInCents = plan.priceInCents
  const publicId = newPublicId()

  const session = await prisma.checkoutSession.create({
    data: {
      publicId,
      planId: plan.id,
      status: "PENDING",
      clinicName: input.clinicName,
      desiredSlug: slug,
      ownerName: input.ownerName,
      ownerEmail: input.ownerEmail.toLowerCase(),
      ownerPhone: input.ownerPhone,
      companyDocument: input.companyDocument,
      city: input.city,
      state: input.state,
      amountInCents,
      billingInterval: plan.billingInterval,
      externalProvider: "ASAAS",
      expiresAt: new Date(Date.now() + 7 * 86_400_000),
    },
  })

  try {
    const customer = await createAsaasCustomer({ name: input.ownerName, email: input.ownerEmail, phone: input.ownerPhone, cpfCnpj: input.companyDocument })
    const nextDue = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10)
    const sub = await createAsaasSubscription({
      customerId: customer.id,
      valueInReais: amountInCents / 100,
      cycle,
      description: `Sinery — ${plan.name} (${slug})`,
      externalReference: publicId,
      nextDueDate: nextDue,
    })
    const updated = await prisma.checkoutSession.update({
      where: { id: session.id },
      data: {
        status: "AWAITING_PAYMENT",
        externalCustomerId: customer.id,
        externalSubscriptionId: sub.subscriptionId,
        externalPaymentId: sub.paymentId,
        externalPaymentUrl: sub.invoiceUrl,
      },
    })
    return {
      ok: true,
      data: {
        publicId,
        status: updated.status,
        paymentUrl: sub.invoiceUrl,
        expiresAt: updated.expiresAt?.toISOString(),
        plan: { name: plan.name, amountInCents },
      },
    }
  } catch (error) {
    const message = sanitizeAsaasError(error)
    logger.error("Falha ao iniciar checkout Asaas", { context: "asaas.checkout", metadata: { error: message } })
    await prisma.checkoutSession.update({ where: { id: session.id }, data: { status: "FAILED", errorMessage: message } })
    return { ok: false, status: 502, error: "Não foi possível iniciar o checkout agora." }
  }
}

// --- public status ---------------------------------------------------------

export async function getPublicCheckoutStatus(publicId: string) {
  const s = await prisma.checkoutSession.findUnique({
    where: { publicId },
    include: { clinic: { select: { slug: true } }, plan: { select: { name: true } } },
  })
  if (!s) return null
  const provisioned = s.status === "PROVISIONED"
  return {
    status: s.status,
    plan: s.plan?.name ?? null,
    amountInCents: s.amountInCents,
    paymentUrl: s.externalPaymentUrl,
    appUrl: provisioned && s.clinic ? clinicAppUrl(s.clinic.slug) : null,
    ownerEmail: provisioned ? s.ownerEmail : null,
    message: provisioned ? "Acesso criado! Verifique seu e-mail para a senha provisória." : null,
  }
}

// --- webhook processing ----------------------------------------------------

export type WebhookOutcome = "provisioned" | "duplicate" | "overdue" | "ignored" | "processed"

async function markEvent(id: string, data: { processed?: boolean; ignored?: boolean; clinicId?: string; checkoutSessionId?: string; errorCode?: string }) {
  await prisma.paymentProviderEvent.update({
    where: { id },
    data: { ...data, processedAt: new Date() },
  }).catch(() => {})
}

async function findSessionForEvent(subscriptionId?: string, paymentId?: string) {
  if (subscriptionId) {
    const bySub = await prisma.checkoutSession.findFirst({ where: { externalSubscriptionId: subscriptionId } })
    if (bySub) return bySub
  }
  if (paymentId) {
    return prisma.checkoutSession.findFirst({ where: { externalPaymentId: paymentId } })
  }
  return null
}

export async function processAsaasWebhookEvent(rawPayload: unknown): Promise<{ outcome: WebhookOutcome }> {
  const parsed = parseAsaasWebhook(rawPayload)
  if (!parsed) return { outcome: "ignored" }

  const payloadHash = asaasPayloadHash(parsed)
  const existing = await prisma.paymentProviderEvent.findUnique({ where: { payloadHash }, select: { id: true } })
  if (existing) return { outcome: "duplicate" }

  let event
  try {
    event = await prisma.paymentProviderEvent.create({
      data: {
        provider: "ASAAS",
        eventType: parsed.eventType,
        externalPaymentId: parsed.paymentId,
        externalSubscriptionId: parsed.subscriptionId,
        payloadHash,
      },
    })
  } catch {
    // Unique constraint on payloadHash → concurrent re-delivery, treat as duplicate.
    return { outcome: "duplicate" }
  }

  try {
    if (isProvisioningEvent(parsed.eventType)) {
      const session = await findSessionForEvent(parsed.subscriptionId, parsed.paymentId)
      if (!session) {
        await markEvent(event.id, { ignored: true })
        return { outcome: "ignored" }
      }
      if (session.status === "PROVISIONED") {
        await markEvent(event.id, { processed: true, checkoutSessionId: session.id, clinicId: session.clinicId ?? undefined })
        return { outcome: "duplicate" }
      }

      await prisma.checkoutSession.update({ where: { id: session.id }, data: { status: "PROVISIONING", paidAt: new Date() } })

      const plan = session.planId ? await prisma.plan.findUnique({ where: { id: session.planId } }) : null
      const now = new Date()
      const nextDue = addMonths(now, intervalAdvanceMonths((plan?.billingInterval ?? "MONTHLY") as BillingIntervalValue))

      const result = await provisionClinic({
        source: "ASAAS_CHECKOUT",
        clinicName: session.clinicName,
        slug: session.desiredSlug,
        clinicEmail: session.ownerEmail,
        phone: session.ownerPhone ?? undefined,
        city: session.city ?? undefined,
        state: session.state ?? undefined,
        ownerName: session.ownerName,
        ownerEmail: session.ownerEmail,
        planId: session.planId,
        subscription: {
          status: "ACTIVE",
          billingType: "CHECKOUT",
          paymentMethod: "OTHER",
          amountInCents: session.amountInCents,
          currentPeriodStart: now,
          nextDueDate: nextDue,
          graceDays: 20,
          internalNotes: "Provisionada via checkout Asaas.",
          externalProvider: "ASAAS",
          externalSubscriptionId: session.externalSubscriptionId ?? undefined,
        },
        firstInvoice: {
          amountInCents: session.amountInCents,
          dueDate: now,
          status: "PAID",
          paidAt: now,
          paymentMethod: "OTHER",
          externalPaymentId: parsed.paymentId,
        },
        checkoutSessionId: session.id,
        platformUserId: null,
      })

      if (!result.ok || !result.data) {
        await prisma.checkoutSession.update({ where: { id: session.id }, data: { status: "FAILED", errorMessage: result.error } })
        await markEvent(event.id, { errorCode: "provision_failed" })
        return { outcome: "ignored" }
      }

      const d = result.data
      const tpl = ownerWelcomeCheckoutEmail({ ownerName: d.ownerName, clinicName: d.clinicName, url: d.url, loginEmail: d.ownerEmail, provisionalPassword: d.provisionalPassword })
      await sendTransactionalEmail({
        to: d.ownerEmail,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
        type: "OWNER_WELCOME_CHECKOUT",
        clinicId: d.clinicId,
        userId: d.ownerId,
        metadata: { source: "checkout" },
      })
      await createPlatformAuditLog({ action: PlatformAuditAction.CLINIC_CREATED, targetType: "Clinic", targetId: d.clinicId, metadata: { source: "asaas_checkout", checkoutSessionId: session.id } })

      await markEvent(event.id, { processed: true, clinicId: d.clinicId, checkoutSessionId: session.id })
      return { outcome: "provisioned" }
    }

    if (isOverdueEvent(parsed.eventType)) {
      const session = await findSessionForEvent(parsed.subscriptionId, parsed.paymentId)
      if (session?.clinicId) {
        await prisma.billingInvoice.updateMany({ where: { clinicId: session.clinicId, status: { in: ["PENDING"] } }, data: { status: "OVERDUE" } })
        await prisma.clinicSubscription.updateMany({ where: { clinicId: session.clinicId, status: { in: ["ACTIVE", "TRIALING"] } }, data: { status: "PAST_DUE", overdueSince: new Date() } })
      }
      await markEvent(event.id, { processed: true, checkoutSessionId: session?.id, clinicId: session?.clinicId ?? undefined })
      return { outcome: "overdue" }
    }

    if (isCancellationEvent(parsed.eventType)) {
      const session = await findSessionForEvent(parsed.subscriptionId, parsed.paymentId)
      if (session && session.status !== "PROVISIONED") {
        await prisma.checkoutSession.update({ where: { id: session.id }, data: { status: "CANCELLED" } })
      }
      await markEvent(event.id, { ignored: true, checkoutSessionId: session?.id })
      return { outcome: "ignored" }
    }

    // PAYMENT_CREATED and other events — register + ignore (200).
    await markEvent(event.id, { ignored: true })
    return { outcome: "ignored" }
  } catch (error) {
    await prisma.paymentProviderEvent.update({ where: { id: event.id }, data: { errorMessage: sanitizeAsaasError(error), processedAt: new Date() } }).catch(() => {})
    return { outcome: "ignored" }
  }
}
