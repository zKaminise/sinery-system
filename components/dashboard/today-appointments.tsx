import Link from "next/link"
import { CalendarDays } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AppointmentStatusBadge } from "@/components/appointments/appointment-status-badge"
import { EmptyState } from "@/components/common/empty-state"
import type { DashboardAppointmentItem } from "@/lib/dashboard/queries"

interface TodayAppointmentsProps {
  appointments: DashboardAppointmentItem[]
}

export function TodayAppointments({ appointments }: TodayAppointmentsProps) {
  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <CalendarDays className="size-4.5 text-primary" />
        <CardTitle>Agenda de hoje</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {appointments.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Nenhuma consulta agendada para hoje."
            description="Consultas criadas para hoje aparecerão aqui."
          />
        ) : (
          appointments.map((appt) => (
            <Link
              key={appt.id}
              href={`/agenda/${appt.id}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 transition-colors hover:bg-muted/50"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="w-12 shrink-0 text-sm font-medium text-foreground">
                  {appt.time}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {appt.patientName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {appt.serviceName ?? "Sem serviço"} · {appt.professionalName}
                  </p>
                </div>
              </div>
              <AppointmentStatusBadge status={appt.status} />
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  )
}
