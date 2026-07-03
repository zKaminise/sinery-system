import "server-only"

import { prisma } from "@/lib/prisma"
import {
  getClinicTimeZone,
  getDayOfWeekForDate,
  getDayRangeUtc,
  utcToClinicParts,
  clinicToday,
} from "@/lib/appointments/date-utils"
import { BLOCKING_STATUSES } from "@/lib/appointments/availability"
import type { AssistPeriod } from "@/lib/assist/date-parser"

export interface RawSlot {
  option: number
  professionalId: string
  professionalName: string
  serviceId: string
  serviceName: string
  date: string
  startTime: string
  endTime: string
  displayDate: string
  displayTime: string
}

export type SlotsEmptyReason =
  | "SERVICE_INACTIVE"
  | "NO_PROFESSIONAL_LINKED"
  | "NO_WORKING_HOURS"
  | "FULLY_BOOKED"
  | "INVALID_DATE"

export interface FindSlotsResult {
  slots: RawSlot[]
  reasonIfEmpty: SlotsEmptyReason | null
}

/** Adds minutes to an "HH:mm" string; returns null past 24:00. */
function addMinutes(time: string, minutes: number): string | null {
  const [h, m] = time.split(":").map(Number)
  const total = h * 60 + m + minutes
  if (total > 24 * 60) return null
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
}

/** True if "HH:mm" falls in the requested period. ANY/null always passes. */
function inPeriod(startTime: string, period: AssistPeriod | null | undefined): boolean {
  if (!period || period === "ANY") return true
  if (period === "MORNING") return startTime < "12:00"
  if (period === "AFTERNOON") return startTime >= "12:00" && startTime < "18:00"
  if (period === "EVENING") return startTime >= "18:00"
  return true
}

function displayDate(dateStr: string): string {
  const [, m, d] = dateStr.split("-")
  return `${d}/${m}`
}

interface FindSlotsInput {
  clinicId: string
  serviceId: string
  date: string
  limit?: number
  period?: AssistPeriod | null
  preferredProfessionalId?: string
}

/**
 * Finds bookable slots for a service on a date, reusing the exact agenda rules:
 * active service, active professionals actively linked to it, their active
 * working hours that weekday, ClinicSettings.appointmentSlotMinutes
 * granularity, slot length = service.durationMinutes, and NO overlap with
 * blocking appointments (SCHEDULED/CONFIRMED/RESCHEDULED). Skips past times
 * today and (if given) a period and preferred professional. Returns slots
 * sorted by time then professional, capped at `limit` (default 3), plus a
 * `reasonIfEmpty` classification when there are none.
 */
export async function findAvailableSlots(input: FindSlotsInput): Promise<FindSlotsResult> {
  const limit = input.limit ?? 3
  const empty = (reason: SlotsEmptyReason): FindSlotsResult => ({ slots: [], reasonIfEmpty: reason })

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return empty("INVALID_DATE")

  const [settings, service] = await Promise.all([
    prisma.clinicSettings.findUnique({
      where: { clinicId: input.clinicId },
      select: { timezone: true, appointmentSlotMinutes: true },
    }),
    prisma.service.findFirst({
      where: { id: input.serviceId, clinicId: input.clinicId, status: "ACTIVE" },
      select: { id: true, name: true, durationMinutes: true },
    }),
  ])

  if (!service) return empty("SERVICE_INACTIVE")

  const timeZone = getClinicTimeZone(settings?.timezone)
  const step = settings?.appointmentSlotMinutes ?? 30
  const duration = service.durationMinutes
  const dayOfWeek = getDayOfWeekForDate(input.date, timeZone)
  const dayRange = getDayRangeUtc(input.date, timeZone)
  const today = clinicToday(timeZone)
  const nowTime = input.date === today ? utcToClinicParts(new Date(), timeZone).time : null

  const professionals = await prisma.professional.findMany({
    where: {
      clinicId: input.clinicId,
      status: "ACTIVE",
      services: { some: { serviceId: service.id } },
      ...(input.preferredProfessionalId ? { id: input.preferredProfessionalId } : {}),
    },
    select: {
      id: true,
      name: true,
      workingHours: {
        where: { active: true, dayOfWeek },
        select: { startTime: true, endTime: true },
      },
      appointments: {
        where: {
          status: { in: BLOCKING_STATUSES },
          startAt: { gte: dayRange.start, lt: dayRange.end },
        },
        select: { startAt: true, endAt: true },
      },
    },
  })

  if (professionals.length === 0) return empty("NO_PROFESSIONAL_LINKED")
  if (professionals.every((p) => p.workingHours.length === 0)) return empty("NO_WORKING_HOURS")

  const collected: Omit<RawSlot, "option">[] = []

  for (const prof of professionals) {
    const busy = prof.appointments.map((a) => ({
      start: utcToClinicParts(a.startAt, timeZone).time,
      end: utcToClinicParts(a.endAt, timeZone).time,
    }))

    for (const block of prof.workingHours) {
      let cursor: string | null = block.startTime
      while (cursor) {
        const end = addMinutes(cursor, duration)
        if (!end || end > block.endTime) break

        const overlaps = busy.some((b) => cursor! < b.end && end > b.start)
        const past = nowTime !== null && cursor < nowTime

        if (!overlaps && !past && inPeriod(cursor, input.period)) {
          collected.push({
            professionalId: prof.id,
            professionalName: prof.name,
            serviceId: service.id,
            serviceName: service.name,
            date: input.date,
            startTime: cursor,
            endTime: end,
            displayDate: displayDate(input.date),
            displayTime: cursor,
          })
        }
        cursor = addMinutes(cursor, step)
      }
    }
  }

  collected.sort((a, b) =>
    a.startTime === b.startTime
      ? a.professionalName.localeCompare(b.professionalName)
      : a.startTime.localeCompare(b.startTime)
  )

  const slots = collected.slice(0, limit).map((s, i) => ({ option: i + 1, ...s }))
  return { slots, reasonIfEmpty: slots.length === 0 ? "FULLY_BOOKED" : null }
}
