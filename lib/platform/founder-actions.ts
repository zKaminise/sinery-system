import "server-only"

import { prisma } from "@/lib/prisma"
import { hashPassword, generateProvisionalPassword } from "@/lib/password"
import { slugify, validateSlug } from "@/lib/platform/slug"
import { evaluateSubscriptionStatus } from "@/lib/billing/subscription-status"
import { createPlatformAuditLog, PlatformAuditAction } from "@/lib/platform/platform-audit"
import type { CreateClinicInput, CreateInvoiceInput, InvoiceActionInput, PlanInput, SubscriptionTypeValue } from "@/lib/validators/founder"
import type { Prisma } from "@/lib/generated/prisma/client"

// --- helpers ---------------------------------------------------------------

function parseDateOrNull(value: string | undefined | null): Date | null {
  if (!value) return null
  const [y, m, d] = value.split("-").map(Number)
  if (!y || !m || !d) return null
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0)) // noon UTC to avoid tz edges
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setUTCMonth(d.getUTCMonth() + months)
  return d
}

function reaisToCents(reais: number): number {
  return Math.round((reais || 0) * 100)
}

/** Informational tenant URL for the success screen. */
export function clinicAppUrl(slug: string): string {
  const root = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "").trim()
  if (root && !root.includes("localhost")) return `https://${slug}.app.${root}`
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
}

interface MappedCommercial {
  status: "FREE" | "TRIALING" | "ACTIVE" | "EXEMPT"
  billingInterval: "FREE" | "MONTHLY" | "YEARLY" | "ONE_TIME" | "CUSTOM"
  billingType: "MANUAL" | "CHECKOUT" | "API" | "EXTERNAL"
}

function mapSubscriptionType(type: SubscriptionTypeValue): MappedCommercial {
  switch (type) {
    case "free":
      return { status: "FREE", billingInterval: "FREE", billingType: "MANUAL" }
    case "exempt":
      return { status: "EXEMPT", billingInterval: "FREE", billingType: "MANUAL" }
    case "trial":
      return { status: "TRIALING", billingInterval: "MONTHLY", billingType: "MANUAL" }
    case "yearly":
      return { status: "ACTIVE", billingInterval: "YEARLY", billingType: "MANUAL" }
    case "custom":
      return { status: "ACTIVE", billingInterval: "CUSTOM", billingType: "MANUAL" }
    case "founder_deal":
    case "monthly":
    default:
      return { status: "ACTIVE", billingInterval: "MONTHLY", billingType: "MANUAL" }
  }
}

// --- create clinic ---------------------------------------------------------

export interface CreateClinicResult {
  ok: boolean
  error?: string
  data?: {
    clinicId: string
    slug: string
    url: string
    ownerEmail: string
    provisionalPassword: string
    clinicName: string
    subscriptionStatus: string
    nextDueDate: string | null
    planName: string | null
  }
}

export async function createClinicWithOwner(
  input: CreateClinicInput,
  platformUserId: string
): Promise<CreateClinicResult> {
  const slug = slugify(input.slug)
  const slugCheck = validateSlug(slug)
  if (!slugCheck.ok) return { ok: false, error: slugCheck.error }

  const existing = await prisma.clinic.findUnique({ where: { slug }, select: { id: true } })
  if (existing) return { ok: false, error: `Já existe uma clínica com o slug "${slug}".` }

  const commercial = mapSubscriptionType(input.subscriptionType)
  const now = new Date()
  const start = parseDateOrNull(input.startDate) ?? now
  const trialEnd =
    input.subscriptionType === "trial"
      ? new Date(start.getTime() + input.trialDays * 86_400_000)
      : null
  const nextDueDate =
    commercial.status === "FREE" || commercial.status === "EXEMPT"
      ? null
      : parseDateOrNull(input.nextDueDate) ??
        (input.subscriptionType === "trial" ? trialEnd : addMonths(start, input.subscriptionType === "yearly" ? 12 : 1))

  const amountInCents =
    commercial.status === "FREE" || commercial.status === "EXEMPT" ? 0 : reaisToCents(input.amountInReais)

  const plainPassword = input.ownerPassword ?? generateProvisionalPassword()
  const passwordHash = await hashPassword(plainPassword)

  try {
    const result = await prisma.$transaction(async (tx) => {
      const clinic = await tx.clinic.create({
        data: {
          name: input.name,
          slug,
          segment: input.segment,
          email: input.email,
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
          status: commercial.status,
          billingType: commercial.billingType,
          paymentMethod: "MANUAL",
          amountInCents,
          currency: "BRL",
          trialEndsAt: trialEnd,
          currentPeriodStart: start,
          nextDueDate,
          graceDays: input.graceDays,
          internalNotes: input.internalNotes,
          freeReason: input.subscriptionType === "founder_deal" ? "Founder deal" : undefined,
        },
      })

      let invoice = null
      const isPaidPlan = amountInCents > 0 && nextDueDate
      if (isPaidPlan) {
        invoice = await tx.billingInvoice.create({
          data: {
            clinicId: clinic.id,
            subscriptionId: subscription.id,
            status: "PENDING",
            paymentMethod: "MANUAL",
            amountInCents,
            currency: "BRL",
            dueDate: nextDueDate!,
            internalNotes: "Fatura inicial criada na criação da clínica.",
          },
        })
      }

      await tx.billingEvent.create({
        data: {
          clinicId: clinic.id,
          subscriptionId: subscription.id,
          invoiceId: invoice?.id,
          type: "CLINIC_CREATED",
          message: `Clínica criada com plano ${input.subscriptionType}.`,
          createdByPlatformUserId: platformUserId,
        },
      })

      return { clinic, owner, subscription, invoice }
    })

    // Audits (outside tx — never block creation).
    await createPlatformAuditLog({
      platformUserId,
      action: PlatformAuditAction.CLINIC_CREATED,
      targetType: "Clinic",
      targetId: result.clinic.id,
      metadata: { slug, subscriptionType: input.subscriptionType },
    })
    await createPlatformAuditLog({
      platformUserId,
      action: PlatformAuditAction.OWNER_CREATED,
      targetType: "User",
      targetId: result.owner.id,
      metadata: { clinicId: result.clinic.id },
    })
    await createPlatformAuditLog({
      platformUserId,
      action: PlatformAuditAction.SUBSCRIPTION_CREATED,
      targetType: "ClinicSubscription",
      targetId: result.subscription.id,
      metadata: { clinicId: result.clinic.id, status: commercial.status },
    })
    if (result.invoice) {
      await createPlatformAuditLog({
        platformUserId,
        action: PlatformAuditAction.INVOICE_CREATED,
        targetType: "BillingInvoice",
        targetId: result.invoice.id,
        metadata: { clinicId: result.clinic.id, amountInCents },
      })
    }

    const plan = input.planId
      ? await prisma.plan.findUnique({ where: { id: input.planId }, select: { name: true } })
      : null

    return {
      ok: true,
      data: {
        clinicId: result.clinic.id,
        slug,
        url: clinicAppUrl(slug),
        ownerEmail: result.owner.email,
        provisionalPassword: plainPassword,
        clinicName: result.clinic.name,
        subscriptionStatus: commercial.status,
        nextDueDate: nextDueDate ? nextDueDate.toISOString().slice(0, 10) : null,
        planName: plan?.name ?? null,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao criar a clínica."
    return { ok: false, error: message.includes("Unique") ? "Slug ou e-mail já em uso." : "Não foi possível criar a clínica." }
  }
}

// --- status actions (suspend / reactivate / recalculate) -------------------

export async function applyClinicStatusAction(
  clinicId: string,
  action: "suspend" | "reactivate" | "recalculate",
  platformUserId: string,
  reason?: string
): Promise<{ ok: boolean; error?: string; clinicStatus?: string }> {
  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    include: { subscription: true },
  })
  if (!clinic) return { ok: false, error: "Clínica não encontrada." }

  if (action === "suspend") {
    await prisma.clinic.update({ where: { id: clinicId }, data: { status: "SUSPENDED" } })
    if (clinic.subscription) {
      await prisma.clinicSubscription.update({
        where: { id: clinic.subscription.id },
        data: { status: "SUSPENDED", suspendedAt: new Date() },
      })
    }
    await prisma.billingEvent.create({
      data: { clinicId, type: "CLINIC_SUSPENDED", message: reason ?? "Suspensão manual pelo founder.", createdByPlatformUserId: platformUserId },
    })
    await createPlatformAuditLog({ platformUserId, action: PlatformAuditAction.CLINIC_SUSPENDED, targetType: "Clinic", targetId: clinicId, metadata: { reason: reason ?? "manual" } })
    return { ok: true, clinicStatus: "SUSPENDED" }
  }

  if (action === "reactivate") {
    await prisma.clinic.update({ where: { id: clinicId }, data: { status: "ACTIVE" } })
    if (clinic.subscription) {
      // Reactivating clears the suspension; if still past due it becomes PAST_DUE, else ACTIVE.
      const evalResult = evaluateSubscriptionStatus(
        {
          status: clinic.subscription.status === "SUSPENDED" ? "PAST_DUE" : clinic.subscription.status,
          trialEndsAt: clinic.subscription.trialEndsAt,
          nextDueDate: clinic.subscription.nextDueDate,
          overdueSince: clinic.subscription.overdueSince,
          graceDays: clinic.subscription.graceDays,
          cancelledAt: null,
        },
        new Date()
      )
      await prisma.clinicSubscription.update({
        where: { id: clinic.subscription.id },
        data: { status: evalResult.subscriptionStatus === "SUSPENDED" ? "PAST_DUE" : evalResult.subscriptionStatus, suspendedAt: null },
      })
    }
    await prisma.billingEvent.create({
      data: { clinicId, type: "CLINIC_REACTIVATED", message: reason ?? "Liberação manual pelo founder.", createdByPlatformUserId: platformUserId },
    })
    await createPlatformAuditLog({ platformUserId, action: PlatformAuditAction.CLINIC_REACTIVATED, targetType: "Clinic", targetId: clinicId })
    return { ok: true, clinicStatus: "ACTIVE" }
  }

  // recalculate
  return recalcClinicStatus(clinicId, platformUserId)
}

/** Re-evaluates subscription + clinic status from the rules and persists it. */
export async function recalcClinicStatus(
  clinicId: string,
  platformUserId: string | null
): Promise<{ ok: boolean; error?: string; clinicStatus?: string }> {
  const sub = await prisma.clinicSubscription.findUnique({ where: { clinicId } })
  if (!sub) return { ok: false, error: "Assinatura não encontrada." }

  const result = evaluateSubscriptionStatus(
    {
      status: sub.status,
      trialEndsAt: sub.trialEndsAt,
      nextDueDate: sub.nextDueDate,
      overdueSince: sub.overdueSince,
      graceDays: sub.graceDays,
      cancelledAt: sub.cancelledAt,
    },
    new Date()
  )

  await prisma.clinicSubscription.update({
    where: { id: sub.id },
    data: {
      status: result.subscriptionStatus,
      overdueSince: result.overdueSince,
      suspendedAt: result.shouldSuspend ? sub.suspendedAt ?? new Date() : result.subscriptionStatus === "SUSPENDED" ? sub.suspendedAt : null,
    },
  })

  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { status: true } })
  // Only automatic pay-related transitions touch clinic.status; keep INACTIVE/SETUP_PENDING as-is.
  let newClinicStatus = clinic?.status
  if (result.clinicStatus === "SUSPENDED") newClinicStatus = "SUSPENDED"
  else if (result.clinicStatus === "ACTIVE" && clinic?.status === "SUSPENDED") newClinicStatus = "ACTIVE"

  if (newClinicStatus && newClinicStatus !== clinic?.status) {
    await prisma.clinic.update({ where: { id: clinicId }, data: { status: newClinicStatus } })
  }

  await createPlatformAuditLog({
    platformUserId,
    action: PlatformAuditAction.BILLING_STATUS_RECALCULATED,
    targetType: "Clinic",
    targetId: clinicId,
    metadata: { subscriptionStatus: result.subscriptionStatus, clinicStatus: newClinicStatus, overdueDays: result.overdueDays },
  })

  return { ok: true, clinicStatus: newClinicStatus ?? undefined }
}

/** Recalculates every clinic (used by the billing "recalcular todos" button). */
export async function recalcAllClinics(platformUserId: string): Promise<{ processed: number; suspended: number }> {
  const subs = await prisma.clinicSubscription.findMany({ select: { clinicId: true } })
  let suspended = 0
  for (const s of subs) {
    const r = await recalcClinicStatus(s.clinicId, platformUserId)
    if (r.clinicStatus === "SUSPENDED") suspended++
  }
  return { processed: subs.length, suspended }
}

// --- invoices --------------------------------------------------------------

export async function createInvoice(
  clinicId: string,
  input: CreateInvoiceInput,
  platformUserId: string
): Promise<{ ok: boolean; error?: string; invoiceId?: string }> {
  const sub = await prisma.clinicSubscription.findUnique({ where: { clinicId }, select: { id: true } })
  const dueDate = parseDateOrNull(input.dueDate)
  if (!dueDate) return { ok: false, error: "Data de vencimento inválida." }

  const invoice = await prisma.billingInvoice.create({
    data: {
      clinicId,
      subscriptionId: sub?.id,
      status: "PENDING",
      paymentMethod: input.paymentMethod,
      amountInCents: reaisToCents(input.amountInReais),
      dueDate,
      internalNotes: input.internalNotes,
    },
  })
  await prisma.billingEvent.create({
    data: { clinicId, subscriptionId: sub?.id, invoiceId: invoice.id, type: "INVOICE_CREATED", message: "Fatura manual criada.", createdByPlatformUserId: platformUserId },
  })
  await createPlatformAuditLog({ platformUserId, action: PlatformAuditAction.INVOICE_CREATED, targetType: "BillingInvoice", targetId: invoice.id, metadata: { clinicId } })
  return { ok: true, invoiceId: invoice.id }
}

export async function applyInvoiceAction(
  invoiceId: string,
  input: InvoiceActionInput,
  platformUserId: string
): Promise<{ ok: boolean; error?: string }> {
  const invoice = await prisma.billingInvoice.findUnique({ where: { id: invoiceId }, include: { subscription: true } })
  if (!invoice) return { ok: false, error: "Fatura não encontrada." }

  if (input.action === "cancel") {
    await prisma.billingInvoice.update({ where: { id: invoiceId }, data: { status: "CANCELLED", cancelledAt: new Date() } })
    await prisma.billingEvent.create({ data: { clinicId: invoice.clinicId, invoiceId, type: "INVOICE_CANCELLED", message: "Fatura cancelada.", createdByPlatformUserId: platformUserId } })
    await createPlatformAuditLog({ platformUserId, action: PlatformAuditAction.INVOICE_CANCELLED, targetType: "BillingInvoice", targetId: invoiceId, metadata: { clinicId: invoice.clinicId } })
    return { ok: true }
  }

  if (input.action === "mark_overdue") {
    await prisma.billingInvoice.update({ where: { id: invoiceId }, data: { status: "OVERDUE" } })
    await createPlatformAuditLog({ platformUserId, action: PlatformAuditAction.INVOICE_MARKED_OVERDUE, targetType: "BillingInvoice", targetId: invoiceId, metadata: { clinicId: invoice.clinicId } })
    // Recalc will suspend if past grace.
    await recalcClinicStatus(invoice.clinicId, platformUserId)
    return { ok: true }
  }

  // mark_paid
  await prisma.billingInvoice.update({
    where: { id: invoiceId },
    data: {
      status: "PAID",
      paidAt: new Date(),
      paymentMethod: input.paymentMethod ?? invoice.paymentMethod,
      manualPaymentReference: input.manualPaymentReference,
    },
  })

  // Advance the subscription: ACTIVE + next period, clear overdue. Manual
  // billing advances by 1 month by default (yearly plans are re-invoiced
  // manually by the founder).
  if (invoice.subscription) {
    const sub = invoice.subscription
    const base = sub.nextDueDate ?? new Date()
    const nextDue = addMonths(base, 1)
    await prisma.clinicSubscription.update({
      where: { id: sub.id },
      data: { status: "ACTIVE", overdueSince: null, suspendedAt: null, currentPeriodStart: base, nextDueDate: nextDue },
    })
    // If the clinic was suspended for non-payment, reactivate it.
    const clinic = await prisma.clinic.findUnique({ where: { id: invoice.clinicId }, select: { status: true } })
    if (clinic?.status === "SUSPENDED") {
      await prisma.clinic.update({ where: { id: invoice.clinicId }, data: { status: "ACTIVE" } })
    }
  }

  await prisma.billingEvent.create({ data: { clinicId: invoice.clinicId, subscriptionId: invoice.subscriptionId, invoiceId, type: "INVOICE_PAID", message: "Pagamento registrado manualmente.", createdByPlatformUserId: platformUserId } })
  await createPlatformAuditLog({ platformUserId, action: PlatformAuditAction.INVOICE_MARKED_PAID, targetType: "BillingInvoice", targetId: invoiceId, metadata: { clinicId: invoice.clinicId } })
  return { ok: true }
}

// --- plans -----------------------------------------------------------------

export async function upsertPlan(
  input: PlanInput,
  platformUserId: string,
  planId?: string
): Promise<{ ok: boolean; error?: string; planId?: string }> {
  const slug = slugify(input.slug)
  if (!slug) return { ok: false, error: "Slug do plano inválido." }

  const data: Prisma.PlanUncheckedCreateInput = {
    name: input.name,
    slug,
    description: input.description,
    priceInCents: reaisToCents(input.priceInReais),
    billingInterval: input.billingInterval,
    includesAi: input.includesAi,
    includesWhatsapp: input.includesWhatsapp,
    active: input.active,
  }

  try {
    if (planId) {
      const plan = await prisma.plan.update({ where: { id: planId }, data })
      await createPlatformAuditLog({ platformUserId, action: PlatformAuditAction.PLAN_UPDATED, targetType: "Plan", targetId: plan.id })
      return { ok: true, planId: plan.id }
    }
    const plan = await prisma.plan.create({ data })
    await createPlatformAuditLog({ platformUserId, action: PlatformAuditAction.PLAN_CREATED, targetType: "Plan", targetId: plan.id })
    return { ok: true, planId: plan.id }
  } catch (error) {
    const message = error instanceof Error ? error.message : ""
    return { ok: false, error: message.includes("Unique") ? "Já existe um plano com esse slug." : "Não foi possível salvar o plano." }
  }
}

// --- billing notification mock (future Resend) -----------------------------

export async function createBillingNotificationMock(
  clinicId: string,
  type: "PAYMENT_DUE_SOON" | "PAYMENT_DUE_TODAY" | "PAYMENT_OVERDUE" | "PAYMENT_SUSPENSION_WARNING" | "PAYMENT_SUSPENDED" | "PAYMENT_CONFIRMED",
  platformUserId: string,
  invoiceId?: string
): Promise<{ ok: boolean; error?: string }> {
  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { email: true, name: true } })
  if (!clinic) return { ok: false, error: "Clínica não encontrada." }

  const subjects: Record<string, string> = {
    PAYMENT_DUE_SOON: "Seu pagamento Sinery vence em breve",
    PAYMENT_DUE_TODAY: "Seu pagamento Sinery vence hoje",
    PAYMENT_OVERDUE: "Pagamento Sinery em atraso",
    PAYMENT_SUSPENSION_WARNING: "Aviso: seu acesso Sinery pode ser suspenso",
    PAYMENT_SUSPENDED: "Seu acesso Sinery foi suspenso",
    PAYMENT_CONFIRMED: "Pagamento Sinery confirmado — obrigado!",
  }

  await prisma.billingNotificationLog.create({
    data: {
      clinicId,
      invoiceId,
      type,
      status: "MOCKED",
      recipientEmail: clinic.email ?? "sem-email@clinica.local",
      subject: subjects[type],
      preview: `Olá, ${clinic.name}. ${subjects[type]}. (Este é um lembrete simulado — o envio real por e-mail será implementado com o Resend.)`,
    },
  })

  await createPlatformAuditLog({ platformUserId, action: PlatformAuditAction.NOTIFICATION_MOCKED, targetType: "Clinic", targetId: clinicId, metadata: { type } })
  return { ok: true }
}
