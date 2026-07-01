"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Pencil,
  UserCheck,
  UserX,
  Archive,
  Phone,
  Mail,
  IdCard,
  Cake,
  Tag,
  CalendarClock,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PatientStatusBadge } from "@/components/patients/patient-status-badge"
import { PatientFormDialog } from "@/components/patients/patient-form-dialog"
import type { PatientDetail } from "@/components/patients/types"
import type { PatientStatus } from "@/lib/generated/prisma/client"

export interface PatientAppointmentSummary {
  id: string
  startAt: string
  status: string
  serviceName: string | null
  professionalName: string
}

function formatDate(iso: string | null): string {
  if (!iso) return "Não informado"
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(iso))
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(iso)
  )
}

interface PatientDetailsProps {
  patient: PatientDetail
  appointments: PatientAppointmentSummary[]
  canEdit: boolean
  canChangeStatus: boolean
  canArchive: boolean
}

export function PatientDetails({
  patient,
  appointments,
  canEdit,
  canChangeStatus,
  canArchive,
}: PatientDetailsProps) {
  const router = useRouter()
  const [formOpen, setFormOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const isArchived = patient.status === "ARCHIVED"

  async function changeStatus(status: PatientStatus) {
    setBusy(true)
    try {
      const response = await fetch(`/api/patients/${patient.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.error?.message ?? "Não foi possível atualizar o paciente.")
        return
      }
      toast.success(
        status === "ARCHIVED"
          ? "Paciente arquivado."
          : status === "ACTIVE"
            ? "Paciente ativado."
            : "Paciente inativado."
      )
      router.refresh()
    } catch {
      toast.error("Erro de conexão. Tente novamente.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-foreground">{patient.name}</h2>
          <PatientStatusBadge status={patient.status} />
        </div>

        {!isArchived && (
          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <Button variant="outline" onClick={() => setFormOpen(true)} disabled={busy}>
                <Pencil className="size-4" /> Editar
              </Button>
            )}
            {canChangeStatus && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => changeStatus(patient.status === "ACTIVE" ? "INACTIVE" : "ACTIVE")}
              >
                {patient.status === "ACTIVE" ? (
                  <>
                    <UserX className="size-4" /> Inativar
                  </>
                ) : (
                  <>
                    <UserCheck className="size-4" /> Ativar
                  </>
                )}
              </Button>
            )}
            {canArchive && (
              <Button variant="destructive" disabled={busy} onClick={() => changeStatus("ARCHIVED")}>
                <Archive className="size-4" /> Arquivar
              </Button>
            )}
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados do paciente</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <InfoRow icon={Phone} label="Telefone" value={patient.phone} />
          <InfoRow icon={Mail} label="E-mail" value={patient.email ?? "Não informado"} />
          <InfoRow icon={IdCard} label="CPF/documento" value={patient.document ?? "Não informado"} />
          <InfoRow icon={Cake} label="Data de nascimento" value={formatDate(patient.birthDate)} />
          <InfoRow icon={Tag} label="Origem" value={patient.source ?? "Não informada"} />
          <InfoRow icon={CalendarClock} label="Criado em" value={formatDateTime(patient.createdAt)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Observações</CardTitle>
          <CardDescription>
            Use este campo apenas para informações administrativas. O prontuário clínico
            será tratado em um módulo específico no futuro.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground whitespace-pre-wrap">
            {patient.notes && patient.notes.length > 0 ? patient.notes : "Nenhuma observação registrada."}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico do paciente</CardTitle>
        </CardHeader>
        <CardContent>
          {appointments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Consultas e interações aparecerão aqui nas próximas etapas.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {appointments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">
                      {a.serviceName ?? "Consulta"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(a.startAt)} · {a.professionalName}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">{a.status}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <PatientFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode="edit"
        initial={{
          id: patient.id,
          name: patient.name,
          phone: patient.phone,
          email: patient.email ?? "",
          document: patient.document ?? "",
          birthDate: patient.birthDate ? patient.birthDate.slice(0, 10) : "",
          source: patient.source ?? "",
          notes: patient.notes ?? "",
        }}
        onSaved={() => router.refresh()}
      />
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
