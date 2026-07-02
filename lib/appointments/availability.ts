import type { AppointmentStatus } from "@/lib/generated/prisma/client"

/**
 * Appointment statuses that occupy a time slot for conflict purposes.
 * CANCELLED/COMPLETED/NO_SHOW do NOT block the slot (a cancelled or past
 * appointment shouldn't prevent booking the same time).
 */
export const BLOCKING_STATUSES: AppointmentStatus[] = ["SCHEDULED", "CONFIRMED", "RESCHEDULED"]

export function isBlockingStatus(status: AppointmentStatus): boolean {
  return BLOCKING_STATUSES.includes(status)
}

export interface WorkingHourBlock {
  dayOfWeek: number
  startTime: string
  endTime: string
  active: boolean
}

/**
 * True when the wall-clock interval [startTime, endTime) on `dayOfWeek` fits
 * ENTIRELY inside at least one active working-hour block for that day.
 * "HH:mm" strings compare correctly with plain string comparison (zero-padded
 * 24h). Both edges inclusive of the block bounds.
 */
export function isWithinWorkingHours(
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  workingHours: WorkingHourBlock[]
): boolean {
  return workingHours.some(
    (block) =>
      block.active &&
      block.dayOfWeek === dayOfWeek &&
      startTime >= block.startTime &&
      endTime <= block.endTime
  )
}

export interface ExistingAppointmentInterval {
  id: string
  startAt: Date
  endAt: Date
  status: AppointmentStatus
}

/**
 * Finds a blocking appointment that overlaps [startAt, endAt) for the same
 * professional. Half-open interval overlap: existing.start < newEnd AND
 * existing.end > newStart. Only BLOCKING_STATUSES count. `excludeId` skips the
 * appointment being edited so it doesn't conflict with itself.
 */
export function findConflictingAppointment(
  startAt: Date,
  endAt: Date,
  existing: ExistingAppointmentInterval[],
  excludeId?: string
): ExistingAppointmentInterval | undefined {
  return existing.find((appt) => {
    if (excludeId && appt.id === excludeId) return false
    if (!isBlockingStatus(appt.status)) return false
    return appt.startAt.getTime() < endAt.getTime() && appt.endAt.getTime() > startAt.getTime()
  })
}

/** Status transitions permitted by the agenda's V1 state machine. */
export const ALLOWED_STATUS_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  SCHEDULED: ["CONFIRMED", "CANCELLED", "COMPLETED", "NO_SHOW"],
  RESCHEDULED: ["CONFIRMED", "CANCELLED", "COMPLETED", "NO_SHOW"],
  CONFIRMED: ["CANCELLED", "COMPLETED", "NO_SHOW"],
  // Terminal states — no further status transitions in V1.
  CANCELLED: [],
  COMPLETED: [],
  NO_SHOW: [],
}

export function canTransitionStatus(
  from: AppointmentStatus,
  to: AppointmentStatus
): boolean {
  return ALLOWED_STATUS_TRANSITIONS[from]?.includes(to) ?? false
}

/**
 * Terminal statuses can't be edited (only their existence remains, for
 * history). Used to block reschedule/data edits on cancelled/done/no-show.
 */
export function isTerminalStatus(status: AppointmentStatus): boolean {
  return status === "CANCELLED" || status === "COMPLETED" || status === "NO_SHOW"
}
