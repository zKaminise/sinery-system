"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  User,
  Phone,
  Stethoscope,
  ClipboardList,
  CalendarClock,
  Clock,
  Timer,
  Tag,
  CheckCircle2,
  XCircle,
  CircleCheck,
  UserX,
  Pencil,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AppointmentStatusBadge } from "@/components/appointments/appointment-status-badge"
import { AppointmentFormDialog } from "@/components/appointments/appointment-form-dialog"
import { canTransitionStatus, isTerminalStatus } from "@/lib/appointments/availability"
import type { AgendaFormOptions } from "@/components/appointments/types"
import type { AppointmentStatus, CreatedBySource } from "@/lib/generated/prisma/client"

const sourceLabels: Record<CreatedBySource, string> = {
  USER: "Manual",
  AI: "Sinery Assist",
  SYSTEM: "Sistema",
}

export interface AppointmentDetail {
  id: string
  date: string
  startTime: string
  endTime: string
  durationMinutes: number
  status: AppointmentStatus
  createdBySource: CreatedBySource
  createdByName: string | null
  createdAt: string
  updatedAt: string
  notes: string | null
  patientId: string
  patientName: string
  patientPhone: string
  professionalId: string
  professionalName: string
  serviceId: string | null
  serviceName: string | null
}

interface AppointmentDetailsProps {
  appointment: AppointmentDetail
  formOptions: AgendaFormOptions
  canManage: boolean
}

export function AppointmentDetails({ appointment, formOptions, canManage }: AppointmentDetailsProps) {
  const router = useRouter()
  const [formOpen, setFormOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)

  const status = appointment.status
  const canEdit = canManage && !isTerminalStatus(status)

  async function changeStatus(next: AppointmentStatus, msg: string) {
    setBusy(true)
    try {
      const response = await fetch(`/api/appointments/${appointment.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.error?.message ?? "Não foi possível atualizar a consulta.")
        return
      }
      toast.success(msg)
      router.refresh()
    } catch {
      toast.error("Erro de conexão. Tente novamente.")
    } finally {
      setBusy(false)
    }
  }

  function formatDateBR(dateStr: string) {
    const [y, m, d] = dateStr.split("-")
    return `${d}/${m}/${y}`
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-foreground">Consulta de {appointment.patientName}</h2>
          <AppointmentStatusBadge status={status} />
        </div>

        {canManage && (
          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <Button variant="outline" onClick={() => setFormOpen(true)} disabled={busy}>
                <Pencil className="size-4" /> Editar / remarcar
              </Button>
            )}
            {canTransitionStatus(status, "CONFIRMED") && (
              <Button variant="outline" disabled={busy} onClick={() => changeStatus("CONFIRMED", "Consulta confirmada.")}>
                <CheckCircle2 className="size-4" /> Confirmar
              </Button>
            )}
            {canTransitionStatus(status, "COMPLETED") && (
              <Button variant="outline" disabled={busy} onClick={() => changeStatus("COMPLETED", "Consulta concluída.")}>
                <CircleCheck className="size-4" /> Concluir
              </Button>
            )}
            {canTransitionStatus(status, "NO_SHOW") && (
              <Button variant="outline" disabled={busy} onClick={() => changeStatus("NO_SHOW", "Falta registrada.")}>
                <UserX className="size-4" /> Marcar falta
              </Button>
            )}
            {canTransitionStatus(status, "CANCELLED") && (
              <Button variant="destructive" disabled={busy} onClick={() => changeStatus("CANCELLED", "Consulta cancelada.")}>
                <XCircle className="size-4" /> Cancelar
              </Button>
            )}
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detalhes da consulta</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <LinkRow icon={User} label="Paciente" value={appointment.patientName} href={`/pacientes/${appointment.patientId}`} />
          <InfoRow icon={Phone} label="Telefone" value={appointment.patientPhone || "Não informado"} />
          <LinkRow icon={Stethoscope} label="Profissional" value={appointment.professionalName} href={`/profissionais/${appointment.professionalId}`} />
          {appointment.serviceId ? (
            <LinkRow icon={ClipboardList} label="Serviço" value={appointment.serviceName ?? "—"} href={`/servicos/${appointment.serviceId}`} />
          ) : (
            <InfoRow icon={ClipboardList} label="Serviço" value="Sem serviço específico" />
          )}
          <InfoRow icon={CalendarClock} label="Data" value={formatDateBR(appointment.date)} />
          <InfoRow icon={Clock} label="Horário" value={`${appointment.startTime} – ${appointment.endTime}`} />
          <InfoRow icon={Timer} label="Duração" value={`${appointment.durationMinutes} minutos`} />
          <InfoRow icon={Tag} label="Origem" value={sourceLabels[appointment.createdBySource]} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Observações</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm whitespace-pre-wrap text-foreground">
            {appointment.notes && appointment.notes.length > 0 ? appointment.notes : "Nenhuma observação registrada."}
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
        {appointment.createdByName && (
          <span>Criado por: <span className="font-medium text-foreground">{appointment.createdByName}</span></span>
        )}
        <span>Criado em: <span className="font-medium text-foreground">{appointment.createdAt}</span></span>
        <span>Atualizado em: <span className="font-medium text-foreground">{appointment.updatedAt}</span></span>
      </div>

      {canManage && (
        <AppointmentFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          mode="edit"
          options={formOptions}
          defaultDate={appointment.date}
          initial={{
            id: appointment.id,
            patientId: appointment.patientId,
            professionalId: appointment.professionalId,
            serviceId: appointment.serviceId,
            date: appointment.date,
            startTime: appointment.startTime,
            endTime: appointment.endTime,
            notes: appointment.notes,
          }}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  )
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </div>
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-sm font-medium text-foreground">{value}</span>
      </div>
    </div>
  )
}

function LinkRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  href: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </div>
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Link href={href} className="text-sm font-medium text-foreground hover:underline">
          {value}
        </Link>
      </div>
    </div>
  )
}
