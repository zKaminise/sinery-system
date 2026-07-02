import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { CalendarDays } from "lucide-react"

import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { getCurrentUser } from "@/lib/current-user"
import { canManageAppointments } from "@/lib/permissions"
import { ErrorState } from "@/components/common/error-state"
import { AgendaSummaryCards } from "@/components/appointments/agenda-summary-cards"
import { AgendaPageClient } from "@/components/appointments/agenda-page-client"
import type { AppointmentItem, AgendaFormOptions } from "@/components/appointments/types"
import {
  getClinicTimeZone,
  clinicToday,
  isValidDateStr,
  getDayRangeUtc,
  getWeekRangeUtc,
  getWeekDates,
  utcToClinicParts,
} from "@/lib/appointments/date-utils"
import type { AppointmentStatus, Prisma } from "@/lib/generated/prisma/client"

export const metadata: Metadata = {
  title: "Agenda — Sinery System",
}

const PAGE_SIZE = 20
const AWAITING: AppointmentStatus[] = ["SCHEDULED", "RESCHEDULED"]

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ""
  return value ?? ""
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/api/auth/clear-session")
  }

  const params = await searchParams
  const rawView = firstParam(params.view)
  const view = rawView === "week" || rawView === "list" ? rawView : "day"
  const professionalId = firstParam(params.professionalId)
  const statusFilter = firstParam(params.status)
  const q = firstParam(params.q).trim()
  const pageParam = Number.parseInt(firstParam(params.page), 10)
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1

  const settings = await prisma.clinicSettings.findUnique({
    where: { clinicId: user.clinicId },
    select: { timezone: true, appointmentSlotMinutes: true },
  })
  const timeZone = getClinicTimeZone(settings?.timezone)
  const defaultSlotMinutes = settings?.appointmentSlotMinutes ?? 30
  const today = clinicToday(timeZone)

  const rawDate = firstParam(params.date)
  const date = isValidDateStr(rawDate) ? rawDate : today
  const weekDays = getWeekDates(date, timeZone)

  // Text search across patient (name/phone), professional name, service name.
  const qDigits = q.replace(/\D/g, "")
  const searchOr: Prisma.AppointmentWhereInput[] | undefined = q
    ? [
        { patient: { name: { contains: q, mode: "insensitive" } } },
        { professional: { name: { contains: q, mode: "insensitive" } } },
        { service: { name: { contains: q, mode: "insensitive" } } },
        ...(qDigits ? [{ patient: { phone: { contains: qDigits } } }] : []),
      ]
    : undefined

  // Time window depends on the view. List mode shows upcoming appointments
  // from the selected date onward.
  let dateWhere: Prisma.AppointmentWhereInput = {}
  if (view === "day") {
    const range = getDayRangeUtc(date, timeZone)
    dateWhere = { startAt: { gte: range.start, lt: range.end } }
  } else if (view === "week") {
    const range = getWeekRangeUtc(date, timeZone)
    dateWhere = { startAt: { gte: range.start, lt: range.end } }
  } else {
    const range = getDayRangeUtc(date, timeZone)
    dateWhere = { startAt: { gte: range.start } }
  }

  // Tenant isolation: everything scoped to the logged-in user's clinicId.
  const where: Prisma.AppointmentWhereInput = {
    clinicId: user.clinicId,
    ...(professionalId ? { professionalId } : {}),
    ...(statusFilter ? { status: statusFilter as AppointmentStatus } : {}),
    ...(searchOr ? { OR: searchOr } : {}),
    ...dateWhere,
  }

  let appointments: AppointmentItem[] = []
  let total = 0
  const summary = { today: 0, confirmed: 0, awaiting: 0, cancelled: 0, noShow: 0 }
  let loadFailed = false
  let allProfessionals: { id: string; name: string }[] = []
  let formOptions: AgendaFormOptions = {
    patients: [],
    professionals: [],
    servicesByProfessional: {},
    defaultSlotMinutes,
  }

  const todayRange = getDayRangeUtc(today, timeZone)

  try {
    const selectAppointment = {
      id: true,
      startAt: true,
      endAt: true,
      status: true,
      createdBySource: true,
      notes: true,
      patient: { select: { id: true, name: true } },
      professional: { select: { id: true, name: true } },
      service: { select: { id: true, name: true } },
    } satisfies Prisma.AppointmentSelect

    const listMode = view === "list"

    const [items, count, todayGrouped, profs, activeProfs, patients] = await Promise.all([
      prisma.appointment.findMany({
        where,
        orderBy: { startAt: "asc" },
        ...(listMode ? { skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE } : {}),
        select: selectAppointment,
      }),
      listMode ? prisma.appointment.count({ where }) : Promise.resolve(0),
      // "Today" summary — independent of the currently-viewed date/filters.
      prisma.appointment.groupBy({
        by: ["status"],
        where: { clinicId: user.clinicId, startAt: { gte: todayRange.start, lt: todayRange.end } },
        _count: true,
      }),
      prisma.professional.findMany({
        where: { clinicId: user.clinicId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.professional.findMany({
        where: { clinicId: user.clinicId, status: "ACTIVE" },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          services: {
            where: { service: { status: "ACTIVE" } },
            select: { service: { select: { id: true, name: true, durationMinutes: true } } },
          },
        },
      }),
      prisma.patient.findMany({
        where: { clinicId: user.clinicId, status: { not: "ARCHIVED" } },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ])

    appointments = items.map((a) => {
      const startParts = utcToClinicParts(a.startAt, timeZone)
      const endParts = utcToClinicParts(a.endAt, timeZone)
      return {
        id: a.id,
        date: startParts.date,
        startTime: startParts.time,
        endTime: endParts.time,
        status: a.status,
        createdBySource: a.createdBySource,
        patientId: a.patient.id,
        patientName: a.patient.name,
        professionalId: a.professional.id,
        professionalName: a.professional.name,
        serviceId: a.service?.id ?? null,
        serviceName: a.service?.name ?? null,
        notes: a.notes,
      }
    })
    total = count
    allProfessionals = profs

    for (const g of todayGrouped) {
      summary.today += g._count
      if (g.status === "CONFIRMED") summary.confirmed = g._count
      if (AWAITING.includes(g.status)) summary.awaiting += g._count
      if (g.status === "CANCELLED") summary.cancelled = g._count
      if (g.status === "NO_SHOW") summary.noShow = g._count
    }

    const servicesByProfessional: AgendaFormOptions["servicesByProfessional"] = {}
    for (const p of activeProfs) {
      servicesByProfessional[p.id] = p.services.map((link) => ({
        id: link.service.id,
        name: link.service.name,
        durationMinutes: link.service.durationMinutes,
      }))
    }
    formOptions = {
      patients,
      professionals: activeProfs.map((p) => ({ id: p.id, name: p.name })),
      servicesByProfessional,
      defaultSlotMinutes,
    }
  } catch (error) {
    loadFailed = true
    logger.error("Falha ao carregar a agenda", {
      context: "appointments",
      error,
      metadata: { clinicId: user.clinicId },
    })
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <CalendarDays className="size-5.5" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Agenda</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie consultas, confirmações e horários da clínica.
          </p>
        </div>
      </div>

      {loadFailed ? (
        <ErrorState description="Não foi possível carregar a agenda. Verifique a conexão com o banco e tente novamente." />
      ) : (
        <>
          <AgendaSummaryCards
            today={summary.today}
            confirmed={summary.confirmed}
            awaiting={summary.awaiting}
            cancelled={summary.cancelled}
            noShow={summary.noShow}
          />

          <AgendaPageClient
            appointments={appointments}
            view={view}
            date={date}
            weekDays={weekDays}
            todayDate={today}
            timeZone={timeZone}
            filters={{ professionalId, status: statusFilter, q }}
            professionals={allProfessionals}
            formOptions={formOptions}
            canManage={canManageAppointments(user.role)}
            total={total}
            page={page}
            totalPages={totalPages}
          />
        </>
      )}
    </div>
  )
}
