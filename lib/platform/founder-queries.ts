import "server-only"

import { prisma } from "@/lib/prisma"
import { computeMrrInCents, computeArrInCents, type BillingIntervalValue } from "@/lib/billing/revenue"
import type { SubscriptionStatusValue } from "@/lib/billing/subscription-status"

function startOfMonth(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}
function startOfDay(now = new Date()): Date {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d
}
function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86_400_000)
}

// --- dashboard -------------------------------------------------------------

export interface FounderDashboard {
  clinics: {
    total: number
    active: number
    trialing: number
    suspended: number
    cancelled: number
    overdue: number
    createdLast30Days: number
  }
  revenue: {
    mrrInCents: number
    arrInCents: number
    predictedThisMonthInCents: number
    receivedThisMonthInCents: number
    overdueInCents: number
    pendingInvoices: number
    overdueInvoices: number
  }
  operation: {
    whatsappConfigured: number
    aiEnabled: number
    aiUsedToday: number
  }
}

export async function getFounderDashboard(): Promise<FounderDashboard> {
  const monthStart = startOfMonth()
  const dayStart = startOfDay()

  const [
    totalClinics,
    createdLast30,
    subs,
    receivedAgg,
    overdueAgg,
    pendingInvoices,
    overdueInvoices,
    whatsappConfigured,
    aiEnabled,
    aiUsedTodayGroups,
  ] = await Promise.all([
    prisma.clinic.count(),
    prisma.clinic.count({ where: { createdAt: { gte: daysAgo(30) } } }),
    prisma.clinicSubscription.findMany({
      select: { status: true, amountInCents: true, plan: { select: { billingInterval: true } } },
    }),
    prisma.billingInvoice.aggregate({
      _sum: { amountInCents: true },
      where: { status: { in: ["PAID", "MANUALLY_CONFIRMED"] }, paidAt: { gte: monthStart } },
    }),
    prisma.billingInvoice.aggregate({
      _sum: { amountInCents: true },
      where: { status: { in: ["PENDING", "OVERDUE"] }, dueDate: { lt: new Date() } },
    }),
    prisma.billingInvoice.count({ where: { status: "PENDING" } }),
    prisma.billingInvoice.count({ where: { status: "OVERDUE" } }),
    prisma.whatsAppIntegration.count({ where: { enabled: true } }),
    prisma.aiSettings.count({ where: { enabled: true } }),
    prisma.aiUsageLog.findMany({ where: { createdAt: { gte: dayStart } }, select: { clinicId: true }, distinct: ["clinicId"] }),
  ])

  const countBy = (status: SubscriptionStatusValue) => subs.filter((s) => s.status === status).length
  const revenueSubs = subs.map((s) => ({
    amountInCents: s.amountInCents,
    interval: (s.plan?.billingInterval ?? "MONTHLY") as BillingIntervalValue,
    status: s.status as SubscriptionStatusValue,
  }))
  const mrr = computeMrrInCents(revenueSubs)

  // Predicted this month = sum of monthly-normalized revenue-generating subs.
  return {
    clinics: {
      total: totalClinics,
      active: countBy("ACTIVE"),
      trialing: countBy("TRIALING"),
      suspended: countBy("SUSPENDED"),
      cancelled: countBy("CANCELLED"),
      overdue: countBy("PAST_DUE"),
      createdLast30Days: createdLast30,
    },
    revenue: {
      mrrInCents: mrr,
      arrInCents: computeArrInCents(mrr),
      predictedThisMonthInCents: mrr,
      receivedThisMonthInCents: receivedAgg._sum.amountInCents ?? 0,
      overdueInCents: overdueAgg._sum.amountInCents ?? 0,
      pendingInvoices,
      overdueInvoices,
    },
    operation: {
      whatsappConfigured,
      aiEnabled,
      aiUsedToday: aiUsedTodayGroups.length,
    },
  }
}

// --- clinics list ----------------------------------------------------------

export interface FounderClinicRow {
  id: string
  name: string
  slug: string
  status: string
  createdAt: string
  subscriptionStatus: string | null
  planName: string | null
  amountInCents: number
  nextDueDate: string | null
  overdueDays: number
  whatsappEnabled: boolean
  aiEnabled: boolean
}

export interface ClinicListFilters {
  q?: string
  status?: string
  subscriptionStatus?: string
  overdue?: boolean
}

export async function listClinicsForFounder(filters: ClinicListFilters = {}): Promise<FounderClinicRow[]> {
  const where: Record<string, unknown> = {}
  if (filters.q) {
    where.OR = [
      { name: { contains: filters.q, mode: "insensitive" } },
      { slug: { contains: filters.q, mode: "insensitive" } },
    ]
  }
  if (filters.status) where.status = filters.status
  if (filters.subscriptionStatus) where.subscription = { status: filters.subscriptionStatus }

  const clinics = await prisma.clinic.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      subscription: { include: { plan: { select: { name: true } } } },
      whatsAppIntegration: { select: { enabled: true } },
      aiSettings: { select: { enabled: true } },
    },
  })

  const now = new Date()
  let rows = clinics.map((c) => {
    const sub = c.subscription
    const overdueDays = sub?.overdueSince ? Math.max(0, Math.floor((now.getTime() - sub.overdueSince.getTime()) / 86_400_000)) : 0
    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      status: c.status,
      createdAt: c.createdAt.toISOString(),
      subscriptionStatus: sub?.status ?? null,
      planName: sub?.plan?.name ?? null,
      amountInCents: sub?.amountInCents ?? 0,
      nextDueDate: sub?.nextDueDate ? sub.nextDueDate.toISOString().slice(0, 10) : null,
      overdueDays,
      whatsappEnabled: c.whatsAppIntegration?.enabled ?? false,
      aiEnabled: c.aiSettings?.enabled ?? false,
    }
  })

  if (filters.overdue) rows = rows.filter((r) => r.subscriptionStatus === "PAST_DUE" || r.overdueDays > 0)
  return rows
}

// --- clinic detail ---------------------------------------------------------

export async function getClinicDetailForFounder(clinicId: string) {
  const monthStart = startOfMonth()
  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    include: {
      subscription: { include: { plan: true } },
      whatsAppIntegration: true,
      aiSettings: true,
    },
  })
  if (!clinic) return null

  const [usersCount, patientsCount, professionalsCount, servicesCount, apptThisMonth, convThisMonth, owners, invoices, events, aiUsageMonth] =
    await Promise.all([
      prisma.user.count({ where: { clinicId, status: "ACTIVE" } }),
      prisma.patient.count({ where: { clinicId } }),
      prisma.professional.count({ where: { clinicId } }),
      prisma.service.count({ where: { clinicId } }),
      prisma.appointment.count({ where: { clinicId, createdAt: { gte: monthStart } } }),
      prisma.conversation.count({ where: { clinicId, createdAt: { gte: monthStart } } }),
      prisma.user.findMany({ where: { clinicId, role: { in: ["OWNER", "ADMIN"] } }, select: { id: true, name: true, email: true, role: true, status: true } }),
      prisma.billingInvoice.findMany({ where: { clinicId }, orderBy: { dueDate: "desc" }, take: 20 }),
      prisma.billingEvent.findMany({ where: { clinicId }, orderBy: { createdAt: "desc" }, take: 20 }),
      prisma.aiUsageLog.count({ where: { clinicId, createdAt: { gte: monthStart } } }),
    ])

  return { clinic, counts: { usersCount, patientsCount, professionalsCount, servicesCount, apptThisMonth, convThisMonth, aiUsageMonth }, owners, invoices, events }
}

// --- plans -----------------------------------------------------------------

export async function listPlansForFounder() {
  return prisma.plan.findMany({ orderBy: [{ active: "desc" }, { priceInCents: "asc" }] })
}

// --- billing overview ------------------------------------------------------

export async function getBillingOverview() {
  const monthStart = startOfMonth()
  const [received, predictedSubs, overdue, invoices, paidCount, pendingCount, overdueCount] = await Promise.all([
    prisma.billingInvoice.aggregate({ _sum: { amountInCents: true }, where: { status: { in: ["PAID", "MANUALLY_CONFIRMED"] }, paidAt: { gte: monthStart } } }),
    prisma.clinicSubscription.findMany({ select: { amountInCents: true, status: true, plan: { select: { billingInterval: true } } } }),
    prisma.billingInvoice.aggregate({ _sum: { amountInCents: true }, where: { status: { in: ["PENDING", "OVERDUE"] }, dueDate: { lt: new Date() } } }),
    prisma.billingInvoice.findMany({
      orderBy: { dueDate: "desc" },
      take: 50,
      include: { clinic: { select: { name: true, slug: true } } },
    }),
    prisma.billingInvoice.count({ where: { status: { in: ["PAID", "MANUALLY_CONFIRMED"] } } }),
    prisma.billingInvoice.count({ where: { status: "PENDING" } }),
    prisma.billingInvoice.count({ where: { status: "OVERDUE" } }),
  ])

  const mrr = computeMrrInCents(
    predictedSubs.map((s) => ({ amountInCents: s.amountInCents, interval: (s.plan?.billingInterval ?? "MONTHLY") as BillingIntervalValue, status: s.status as SubscriptionStatusValue }))
  )

  return {
    receivedThisMonthInCents: received._sum.amountInCents ?? 0,
    predictedThisMonthInCents: mrr,
    mrrInCents: mrr,
    arrInCents: computeArrInCents(mrr),
    overdueInCents: overdue._sum.amountInCents ?? 0,
    counts: { paid: paidCount, pending: pendingCount, overdue: overdueCount },
    invoices: invoices.map((i) => ({
      id: i.id,
      clinicName: i.clinic.name,
      clinicSlug: i.clinic.slug,
      amountInCents: i.amountInCents,
      dueDate: i.dueDate.toISOString().slice(0, 10),
      status: i.status,
      paidAt: i.paidAt ? i.paidAt.toISOString().slice(0, 10) : null,
      paymentMethod: i.paymentMethod,
    })),
  }
}
