import { utcToClinicParts } from "@/lib/appointments/date-utils"

/**
 * Formats a message/conversation timestamp for the inbox using the clinic
 * timezone, so server-rendered and client-hydrated output always match
 * (no viewer-locale hydration mismatch). Shows "HH:mm" when it happened today
 * in the clinic timezone, otherwise "dd/MM".
 */
export function formatInboxTimestamp(iso: string, timeZone: string): string {
  const date = new Date(iso)
  const parts = utcToClinicParts(date, timeZone)
  const today = utcToClinicParts(new Date(), timeZone)
  if (parts.date === today.date) return parts.time
  const [, month, day] = parts.date.split("-")
  return `${day}/${month}`
}

/** Full "dd/MM/yyyy HH:mm" for message bubbles / details, in clinic tz. */
export function formatInboxDateTime(iso: string, timeZone: string): string {
  const parts = utcToClinicParts(new Date(iso), timeZone)
  const [year, month, day] = parts.date.split("-")
  return `${day}/${month}/${year} ${parts.time}`
}
