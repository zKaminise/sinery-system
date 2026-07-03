import "server-only"

import { prisma } from "@/lib/prisma"
import { BLOCKING_STATUSES } from "@/lib/appointments/availability"
import { utcToClinicParts } from "@/lib/appointments/date-utils"
import type { AssistAppointmentOption } from "@/lib/assist/types"

/**
 * Upcoming active (blocking) appointments for a patient, scoped to the clinic,
 * ordered soonest first. Used by cancel/reschedule/confirm flows. Returns
 * options already formatted in clinic-local wall clock.
 */
export async function getUpcomingActiveAppointments(
  clinicId: string,
  patientId: string,
  timeZone: string
): Promise<AssistAppointmentOption[]> {
  const rows = await prisma.appointment.findMany({
    where: {
      clinicId,
      patientId,
      status: { in: BLOCKING_STATUSES },
      startAt: { gte: new Date() },
    },
    orderBy: { startAt: "asc" },
    take: 10,
    select: {
      id: true,
      startAt: true,
      service: { select: { id: true, name: true } },
      professional: { select: { name: true } },
    },
  })

  return rows.map((a, i) => {
    const parts = utcToClinicParts(a.startAt, timeZone)
    return {
      index: i + 1,
      appointmentId: a.id,
      serviceId: a.service?.id ?? null,
      serviceName: a.service?.name ?? null,
      professionalName: a.professional.name,
      date: parts.date,
      startTime: parts.time,
    }
  })
}

/** "hoje" / "amanhã" / "dd/MM" for an appointment option's date. */
export function optionDateLabel(dateStr: string, todayStr: string): string {
  const [ty, tm, td] = todayStr.split("-").map(Number)
  const tomorrow = new Date(Date.UTC(ty, tm - 1, td) + 86_400_000)
  const tomorrowStr = `${tomorrow.getUTCFullYear()}-${String(tomorrow.getUTCMonth() + 1).padStart(2, "0")}-${String(tomorrow.getUTCDate()).padStart(2, "0")}`
  if (dateStr === todayStr) return "hoje"
  if (dateStr === tomorrowStr) return "amanhã"
  const [, m, d] = dateStr.split("-")
  return `${d}/${m}`
}
