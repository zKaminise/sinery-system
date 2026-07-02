import "server-only"

import { prisma } from "@/lib/prisma"
import {
  getClinicTimeZone,
  clinicToday,
  getDayRangeUtc,
  getWeekRangeUtc,
  utcToClinicParts,
} from "@/lib/appointments/date-utils"
import type { AppointmentStatus } from "@/lib/generated/prisma/client"

const PENDING_STATUSES: AppointmentStatus[] = ["SCHEDULED", "RESCHEDULED"]
const UPCOMING_STATUSES: AppointmentStatus[] = ["SCHEDULED", "RESCHEDULED", "CONFIRMED"]
const UPCOMING_LIMIT = 6
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export interface DashboardAppointmentItem {
  id: string
  date: string
  time: string
  patientName: string
  professionalName: string
  serviceName: string | null
  status: AppointmentStatus
}

export interface DashboardAlertProfessional {
  id: string
  name: string
}

export interface DashboardData {
  timeZone: string
  today: string
  summary: {
    appointmentsToday: number
    confirmedToday: number
    pendingConfirmationToday: number
    activePatients: number
    activeProfessionals: number
    activeServices: number
    cancelledThisWeek: number
    noShowThisWeek: number
  }
  week: {
    total: number
    confirmed: number
    cancelled: number
    completed: number
    noShow: number
  }
  todayAppointments: DashboardAppointmentItem[]
  upcomingAppointments: DashboardAppointmentItem[]
  alerts: {
    pendingConfirmationUpcoming: number
    cancelledLast7Days: number
    archivedPatients: number
    professionalsWithoutWorkingHours: DashboardAlertProfessional[]
    professionalsWithoutServices: DashboardAlertProfessional[]
    servicesWithoutProfessionals: DashboardAlertProfessional[]
  }
  assist: {
    aiHandledConversations: number
    aiScheduledAppointments: number
    pendingConversations: number
  }
}

const selectAppointment = {
  id: true,
  startAt: true,
  status: true,
  patient: { select: { name: true } },
  professional: { select: { name: true } },
  service: { select: { name: true } },
} as const

type RawAppointment = {
  id: string
  startAt: Date
  status: AppointmentStatus
  patient: { name: string }
  professional: { name: string }
  service: { name: string } | null
}

function toItem(appt: RawAppointment, timeZone: string): DashboardAppointmentItem {
  const parts = utcToClinicParts(appt.startAt, timeZone)
  return {
    id: appt.id,
    date: parts.date,
    time: parts.time,
    patientName: appt.patient.name,
    professionalName: appt.professional.name,
    serviceName: appt.service?.name ?? null,
    status: appt.status,
  }
}

/**
 * Loads every metric the dashboard displays for `clinicId`. Every query is
 * scoped by clinicId (taken from the caller's session, never trusted from
 * the client) and batched with Promise.all to avoid a waterfall — this is
 * the only place all this dashboard data is assembled.
 *
 * "Today" and "this week" use the clinic's timezone (`ClinicSettings.timezone`,
 * default America/Sao_Paulo) via the same `lib/appointments/date-utils.ts`
 * helpers the agenda module uses, so a consultation counted as "today" here
 * always matches what /agenda shows for the same day. See docs/dashboard.md.
 */
export async function getDashboardData(clinicId: string): Promise<DashboardData> {
  const settings = await prisma.clinicSettings.findUnique({
    where: { clinicId },
    select: { timezone: true },
  })
  const timeZone = getClinicTimeZone(settings?.timezone)
  const today = clinicToday(timeZone)
  const todayRange = getDayRangeUtc(today, timeZone)
  const weekRange = getWeekRangeUtc(today, timeZone)
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - SEVEN_DAYS_MS)

  const [
    todayAppointmentsRaw,
    confirmedToday,
    pendingConfirmationToday,
    activePatients,
    activeProfessionals,
    activeServices,
    weekGrouped,
    upcomingRaw,
    pendingConfirmationUpcoming,
    cancelledLast7Days,
    archivedPatients,
    professionalsForAlerts,
    servicesWithoutProfessionals,
    aiHandledConversations,
    aiScheduledAppointments,
    pendingConversations,
  ] = await Promise.all([
    prisma.appointment.findMany({
      where: { clinicId, startAt: { gte: todayRange.start, lt: todayRange.end } },
      orderBy: { startAt: "asc" },
      select: selectAppointment,
    }),
    prisma.appointment.count({
      where: { clinicId, status: "CONFIRMED", startAt: { gte: todayRange.start, lt: todayRange.end } },
    }),
    prisma.appointment.count({
      where: {
        clinicId,
        status: { in: PENDING_STATUSES },
        startAt: { gte: todayRange.start, lt: todayRange.end },
      },
    }),
    prisma.patient.count({ where: { clinicId, status: "ACTIVE" } }),
    prisma.professional.count({ where: { clinicId, status: "ACTIVE" } }),
    prisma.service.count({ where: { clinicId, status: "ACTIVE" } }),
    prisma.appointment.groupBy({
      by: ["status"],
      where: { clinicId, startAt: { gte: weekRange.start, lt: weekRange.end } },
      _count: true,
    }),
    prisma.appointment.findMany({
      where: {
        clinicId,
        status: { in: UPCOMING_STATUSES },
        startAt: { gte: todayRange.end },
      },
      orderBy: { startAt: "asc" },
      take: UPCOMING_LIMIT,
      select: selectAppointment,
    }),
    prisma.appointment.count({
      where: { clinicId, status: { in: PENDING_STATUSES }, startAt: { gte: now } },
    }),
    prisma.appointment.count({
      where: { clinicId, status: "CANCELLED", startAt: { gte: sevenDaysAgo, lte: now } },
    }),
    prisma.patient.count({ where: { clinicId, status: "ARCHIVED" } }),
    prisma.professional.findMany({
      where: { clinicId, status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        workingHours: { where: { active: true }, select: { id: true }, take: 1 },
        services: { where: { service: { status: "ACTIVE" } }, select: { id: true }, take: 1 },
      },
    }),
    prisma.service.findMany({
      where: {
        clinicId,
        status: "ACTIVE",
        professionals: { none: { professional: { status: "ACTIVE" } } },
      },
      select: { id: true, name: true },
    }),
    prisma.conversation.count({ where: { clinicId, messages: { some: { senderType: "AI" } } } }),
    prisma.appointment.count({ where: { clinicId, createdBySource: "AI" } }),
    prisma.conversation.count({ where: { clinicId, status: "WAITING_HUMAN" } }),
  ])

  const week = { total: 0, confirmed: 0, cancelled: 0, completed: 0, noShow: 0 }
  let cancelledThisWeek = 0
  let noShowThisWeek = 0
  for (const g of weekGrouped) {
    week.total += g._count
    if (g.status === "CONFIRMED") week.confirmed = g._count
    if (g.status === "CANCELLED") {
      week.cancelled = g._count
      cancelledThisWeek = g._count
    }
    if (g.status === "COMPLETED") week.completed = g._count
    if (g.status === "NO_SHOW") {
      week.noShow = g._count
      noShowThisWeek = g._count
    }
  }

  return {
    timeZone,
    today,
    summary: {
      appointmentsToday: todayAppointmentsRaw.length,
      confirmedToday,
      pendingConfirmationToday,
      activePatients,
      activeProfessionals,
      activeServices,
      cancelledThisWeek,
      noShowThisWeek,
    },
    week,
    todayAppointments: todayAppointmentsRaw.map((a) => toItem(a, timeZone)),
    upcomingAppointments: upcomingRaw.map((a) => toItem(a, timeZone)),
    alerts: {
      pendingConfirmationUpcoming,
      cancelledLast7Days,
      archivedPatients,
      professionalsWithoutWorkingHours: professionalsForAlerts
        .filter((p) => p.workingHours.length === 0)
        .map((p) => ({ id: p.id, name: p.name })),
      professionalsWithoutServices: professionalsForAlerts
        .filter((p) => p.services.length === 0)
        .map((p) => ({ id: p.id, name: p.name })),
      servicesWithoutProfessionals,
    },
    assist: {
      aiHandledConversations,
      aiScheduledAppointments,
      pendingConversations,
    },
  }
}
