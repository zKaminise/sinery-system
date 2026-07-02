"use client"

import Link from "next/link"

import { cn } from "@/lib/utils"
import { appointmentStatusLabels } from "@/components/appointments/appointment-status-badge"
import { weekdayLabel } from "@/lib/appointments/date-utils"
import type { AppointmentItem } from "@/components/appointments/types"
import type { AppointmentStatus } from "@/lib/generated/prisma/client"

const cardStyles: Record<AppointmentStatus, string> = {
  SCHEDULED: "border-primary/30 bg-primary/5",
  CONFIRMED: "border-success/30 bg-success/5",
  RESCHEDULED: "border-secondary/30 bg-secondary/5",
  CANCELLED: "border-destructive/30 bg-destructive/5 opacity-70",
  COMPLETED: "border-success/40 bg-success/10",
  NO_SHOW: "border-warning/30 bg-warning/5",
}

interface WeekViewProps {
  weekDays: string[]
  todayDate: string
  appointments: AppointmentItem[]
}

/** dayOfWeek (0=Sun..6=Sat) for a "YYYY-MM-DD" (parsed as a plain date). */
function weekdayForDate(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

function dayNumber(dateStr: string): string {
  return String(Number(dateStr.split("-")[2]))
}

export function WeekView({ weekDays, todayDate, appointments }: WeekViewProps) {
  const byDay = new Map<string, AppointmentItem[]>()
  for (const appt of appointments) {
    const list = byDay.get(appt.date) ?? []
    list.push(appt)
    byDay.set(appt.date, list)
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => a.startTime.localeCompare(b.startTime))
  }

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[900px] grid-cols-7 gap-2">
        {weekDays.map((day) => {
          const isToday = day === todayDate
          const items = byDay.get(day) ?? []
          return (
            <div key={day} className="flex flex-col gap-2">
              <div
                className={cn(
                  "flex flex-col items-center rounded-lg border border-border px-2 py-1.5 text-center",
                  isToday && "border-primary bg-primary/5"
                )}
              >
                <span className="text-xs text-muted-foreground">
                  {weekdayLabel(weekdayForDate(day)).slice(0, 3)}
                </span>
                <span className={cn("text-sm font-semibold", isToday ? "text-primary" : "text-foreground")}>
                  {dayNumber(day)}
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                {items.length === 0 ? (
                  <p className="px-1 py-2 text-center text-xs text-muted-foreground/60">—</p>
                ) : (
                  items.map((appt) => (
                    <Link
                      key={appt.id}
                      href={`/agenda/${appt.id}`}
                      className={cn(
                        "flex flex-col gap-0.5 rounded-lg border px-2 py-1.5 transition-colors hover:brightness-95",
                        cardStyles[appt.status]
                      )}
                      title={`${appt.patientName} · ${appointmentStatusLabels[appt.status]}`}
                    >
                      <span className="text-xs font-semibold text-foreground">
                        {appt.startTime}
                      </span>
                      <span className="truncate text-xs text-foreground">{appt.patientName}</span>
                      <span className="truncate text-[11px] text-muted-foreground">
                        {appt.professionalName}
                      </span>
                    </Link>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
