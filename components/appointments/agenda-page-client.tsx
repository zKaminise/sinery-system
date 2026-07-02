"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { AgendaFilters, type AgendaView } from "@/components/appointments/agenda-filters"
import { DayView } from "@/components/appointments/day-view"
import { WeekView } from "@/components/appointments/week-view"
import { ListView } from "@/components/appointments/list-view"
import { AppointmentFormDialog } from "@/components/appointments/appointment-form-dialog"
import { formatClinicDateLong } from "@/lib/appointments/date-utils"
import type {
  AppointmentItem,
  AgendaFormOptions,
  AppointmentEditValues,
} from "@/components/appointments/types"

interface AgendaPageClientProps {
  appointments: AppointmentItem[]
  view: AgendaView
  date: string
  weekDays: string[]
  todayDate: string
  timeZone: string
  filters: { professionalId: string; status: string; q: string }
  professionals: { id: string; name: string }[]
  formOptions: AgendaFormOptions
  canManage: boolean
  // List-view pagination
  total: number
  page: number
  totalPages: number
}

export function AgendaPageClient({
  appointments,
  view,
  date,
  weekDays,
  todayDate,
  timeZone,
  filters,
  professionals,
  formOptions,
  canManage,
  total,
  page,
  totalPages,
}: AgendaPageClientProps) {
  const router = useRouter()
  const [formOpen, setFormOpen] = React.useState(false)
  const [formMode, setFormMode] = React.useState<"create" | "edit">("create")
  const [formInitial, setFormInitial] = React.useState<AppointmentEditValues | undefined>(undefined)

  function openCreate() {
    setFormMode("create")
    setFormInitial(undefined)
    setFormOpen(true)
  }

  function openEdit(appt: AppointmentItem) {
    setFormMode("edit")
    setFormInitial({
      id: appt.id,
      patientId: appt.patientId,
      professionalId: appt.professionalId,
      serviceId: appt.serviceId,
      date: appt.date,
      startTime: appt.startTime,
      endTime: appt.endTime,
      notes: appt.notes,
    })
    setFormOpen(true)
  }

  function listPageHref(targetPage: number): string {
    const sp = new URLSearchParams()
    sp.set("view", "list")
    if (date) sp.set("date", date)
    if (filters.professionalId) sp.set("professionalId", filters.professionalId)
    if (filters.status) sp.set("status", filters.status)
    if (filters.q) sp.set("q", filters.q)
    if (targetPage > 1) sp.set("page", String(targetPage))
    return `/agenda?${sp.toString()}`
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <AgendaFilters
          defaults={{ view, date, ...filters }}
          professionals={professionals}
        />
        {canManage && (
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Nova consulta
          </Button>
        )}
      </div>

      {view === "day" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium capitalize text-foreground">
            {formatClinicDateLong(date, timeZone)}
          </p>
          <DayView appointments={appointments} canManage={canManage} onEdit={openEdit} />
        </div>
      )}

      {view === "week" && (
        <WeekView weekDays={weekDays} todayDate={todayDate} appointments={appointments} />
      )}

      {view === "list" && (
        <div className="flex flex-col gap-3">
          <ListView appointments={appointments} canManage={canManage} onEdit={openEdit} />
          {appointments.length > 0 && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {total} {total === 1 ? "consulta encontrada" : "consultas encontradas"} · página{" "}
                {page} de {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  nativeButton={false}
                  render={page <= 1 ? <span>Anterior</span> : <Link href={listPageHref(page - 1)}>Anterior</Link>}
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  nativeButton={false}
                  render={page >= totalPages ? <span>Próxima</span> : <Link href={listPageHref(page + 1)}>Próxima</Link>}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {canManage && (
        <AppointmentFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          mode={formMode}
          options={formOptions}
          defaultDate={date}
          initial={formInitial}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  )
}
