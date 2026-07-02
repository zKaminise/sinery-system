/**
 * Timezone handling for the agenda (V1)
 * -------------------------------------
 * Decision: the database stores `Appointment.startAt`/`endAt` as absolute UTC
 * instants (Prisma `DateTime`). All user-facing input and display, however,
 * is expressed in the CLINIC's timezone (`ClinicSettings.timezone`, default
 * "America/Sao_Paulo").
 *
 * The form always submits wall-clock components — a `date` ("YYYY-MM-DD") and
 * `startTime`/`endTime` ("HH:mm") that the receptionist typed in clinic-local
 * time. Working-hours and day-of-week validation run directly on those
 * wall-clock strings (no timezone math needed — the strings already ARE
 * clinic-local). Only for storage and conflict detection do we convert the
 * wall-clock to a UTC instant via `zonedWallClockToUtc`, and for display we
 * convert stored instants back with `Intl` + the clinic timezone.
 *
 * This keeps a single, consistent rule ("input/display = clinic tz, storage =
 * UTC") and avoids the classic UTC/local mixups. It is correct for any single
 * IANA timezone (including DST) without pulling in a date library. Multi-
 * timezone-per-clinic is out of scope for V1.
 */

export const DEFAULT_TIMEZONE = "America/Sao_Paulo"

export function getClinicTimeZone(timezone: string | null | undefined): string {
  return timezone && timezone.length > 0 ? timezone : DEFAULT_TIMEZONE
}

/**
 * Returns the offset (in ms) of `timeZone` relative to UTC at the moment
 * `date` represents, i.e. (wall-clock time in tz) − (UTC time). Positive east
 * of UTC. Uses Intl so it accounts for DST automatically.
 */
function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
  const parts = dtf.formatToParts(date)
  const map: Record<string, number> = {}
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = Number(part.value)
  }
  const asUtc = Date.UTC(map.year, map.month - 1, map.day, map.hour, map.minute, map.second)
  return asUtc - date.getTime()
}

/**
 * Converts a clinic-local wall clock (date "YYYY-MM-DD" + time "HH:mm") into
 * the absolute UTC instant it corresponds to in `timeZone`.
 */
export function zonedWallClockToUtc(
  dateStr: string,
  timeStr: string,
  timeZone: string
): Date {
  const [year, month, day] = dateStr.split("-").map(Number)
  const [hour, minute] = timeStr.split(":").map(Number)
  // Treat the wall clock as if it were UTC, then subtract the zone offset at
  // that instant to get the true UTC instant. One correction pass is exact
  // except across the rare instant of a DST transition, which is acceptable
  // for appointment scheduling.
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute, 0)
  const offset = getTimeZoneOffsetMs(new Date(naiveUtc), timeZone)
  return new Date(naiveUtc - offset)
}

export interface ClinicDateParts {
  /** "YYYY-MM-DD" in the clinic timezone. */
  date: string
  /** "HH:mm" in the clinic timezone. */
  time: string
  /** 0 = Sunday ... 6 = Saturday, in the clinic timezone. */
  dayOfWeek: number
}

/** Breaks a stored UTC instant into clinic-local wall-clock parts. */
export function utcToClinicParts(date: Date, timeZone: string): ClinicDateParts {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
  const map: Record<string, string> = {}
  for (const part of dtf.formatToParts(date)) {
    if (part.type !== "literal") map[part.type] = part.value
  }
  const weekdayIndex: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    time: `${map.hour}:${map.minute}`,
    dayOfWeek: weekdayIndex[map.weekday] ?? 0,
  }
}

/** dayOfWeek (0=Sun..6=Sat) for a clinic-local "YYYY-MM-DD" date string. */
export function getDayOfWeekForDate(dateStr: string, timeZone: string): number {
  // Noon avoids any near-midnight DST edge shifting the day.
  const instant = zonedWallClockToUtc(dateStr, "12:00", timeZone)
  return utcToClinicParts(instant, timeZone).dayOfWeek
}

export interface UtcRange {
  start: Date
  end: Date
}

/** UTC range [00:00, next-day 00:00) of a clinic-local day. */
export function getDayRangeUtc(dateStr: string, timeZone: string): UtcRange {
  const start = zonedWallClockToUtc(dateStr, "00:00", timeZone)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { start, end }
}

/** Returns the Monday-based week's clinic-local date strings for a given date. */
export function getWeekDates(dateStr: string, timeZone: string): string[] {
  const dow = getDayOfWeekForDate(dateStr, timeZone) // 0=Sun..6=Sat
  // Days to subtract to reach Monday (treat Sunday as end of week).
  const offsetToMonday = dow === 0 ? 6 : dow - 1
  const [year, month, day] = dateStr.split("-").map(Number)
  const base = Date.UTC(year, month - 1, day)
  const result: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(base + (i - offsetToMonday) * 24 * 60 * 60 * 1000)
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, "0")
    const dd = String(d.getUTCDate()).padStart(2, "0")
    result.push(`${y}-${m}-${dd}`)
  }
  return result
}

/** UTC range covering the whole Monday–Sunday week of a clinic-local date. */
export function getWeekRangeUtc(dateStr: string, timeZone: string): UtcRange {
  const days = getWeekDates(dateStr, timeZone)
  const start = zonedWallClockToUtc(days[0], "00:00", timeZone)
  const lastDayRange = getDayRangeUtc(days[6], timeZone)
  return { start, end: lastDayRange.end }
}

/** "HH:mm" of a stored instant in clinic tz. */
export function formatClinicTime(date: Date, timeZone: string): string {
  return utcToClinicParts(date, timeZone).time
}

/** Localized long date, e.g. "quarta-feira, 2 de julho de 2026". */
export function formatClinicDateLong(dateStr: string, timeZone: string): string {
  const instant = zonedWallClockToUtc(dateStr, "12:00", timeZone)
  return new Intl.DateTimeFormat("pt-BR", { timeZone, dateStyle: "full" }).format(instant)
}

/** Short date "dd/MM/yyyy" of a stored instant in clinic tz. */
export function formatClinicDateShort(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone, dateStyle: "short" }).format(date)
}

const WEEKDAY_LABELS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
]

export function weekdayLabel(dayOfWeek: number): string {
  return WEEKDAY_LABELS[dayOfWeek] ?? ""
}

/** Today's clinic-local date as "YYYY-MM-DD". */
export function clinicToday(timeZone: string): string {
  return utcToClinicParts(new Date(), timeZone).date
}

/** True if `dateStr` ("YYYY-MM-DD") passes a basic shape/validity check. */
export function isValidDateStr(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false
  const [, m, d] = dateStr.split("-").map(Number)
  if (m < 1 || m > 12 || d < 1 || d > 31) return false
  return true
}
