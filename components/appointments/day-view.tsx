"use client"

import Link from "next/link"

import { AppointmentStatusBadge } from "@/components/appointments/appointment-status-badge"
import { AppointmentActions } from "@/components/appointments/appointment-actions"
import { EmptyState } from "@/components/common/empty-state"
import { CalendarDays } from "lucide-react"
import type { AppointmentItem } from "@/components/appointments/types"

interface DayViewProps {
  appointments: AppointmentItem[]
  canManage: boolean
  onEdit: (appointment: AppointmentItem) => void
}

export function DayView({ appointments, canManage, onEdit }: DayViewProps) {
  if (appointments.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Nenhuma consulta neste dia"
        description="Não há consultas agendadas para a data selecionada."
      />
    )
  }

  const sorted = [...appointments].sort((a, b) => a.startTime.localeCompare(b.startTime))

  return (
    <div className="flex flex-col gap-2">
      {sorted.map((appt) => (
        <div
          key={appt.id}
          className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3"
        >
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex w-24 shrink-0 flex-col">
              <span className="text-sm font-semibold text-foreground">{appt.startTime}</span>
              <span className="text-xs text-muted-foreground">até {appt.endTime}</span>
            </div>
            <div className="min-w-0">
              <Link
                href={`/agenda/${appt.id}`}
                className="truncate text-sm font-medium text-foreground hover:underline"
              >
                {appt.patientName}
              </Link>
              <p className="truncate text-xs text-muted-foreground">
                {appt.serviceName ?? "Sem serviço"} · {appt.professionalName}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <AppointmentStatusBadge status={appt.status} />
            <AppointmentActions appointment={appt} canManage={canManage} onEdit={onEdit} />
          </div>
        </div>
      ))}
    </div>
  )
}
