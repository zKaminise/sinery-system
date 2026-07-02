"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Pencil, UserCheck, UserX, Phone, Mail, Tag, CalendarClock, CalendarDays } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ProfessionalStatusBadge } from "@/components/professionals/professional-status-badge"
import { ProfessionalFormDialog } from "@/components/professionals/professional-form-dialog"
import { WorkingHoursManager } from "@/components/professionals/working-hours-manager"
import { ProfessionalServicesManager } from "@/components/professionals/professional-services-manager"
import type { ProfessionalDetail } from "@/components/professionals/types"
import type { ProfessionalStatus } from "@/lib/generated/prisma/client"

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(iso)
  )
}

interface ProfessionalDetailsProps {
  professional: ProfessionalDetail
  availableServices: { id: string; name: string }[]
  canEdit: boolean
  canChangeStatus: boolean
  canManageWorkingHours: boolean
  canManageServices: boolean
}

export function ProfessionalDetails({
  professional,
  availableServices,
  canEdit,
  canChangeStatus,
  canManageWorkingHours,
  canManageServices,
}: ProfessionalDetailsProps) {
  const router = useRouter()
  const [formOpen, setFormOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)

  async function toggleStatus() {
    const nextStatus: ProfessionalStatus = professional.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
    setBusy(true)
    try {
      const response = await fetch(`/api/professionals/${professional.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.error?.message ?? "Não foi possível atualizar o profissional.")
        return
      }
      toast.success(nextStatus === "ACTIVE" ? "Profissional ativado." : "Profissional inativado.")
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
          <h2 className="text-xl font-semibold text-foreground">{professional.name}</h2>
          <ProfessionalStatusBadge status={professional.status} />
        </div>

        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button variant="outline" onClick={() => setFormOpen(true)} disabled={busy}>
              <Pencil className="size-4" /> Editar
            </Button>
          )}
          {canChangeStatus && (
            <Button variant="outline" disabled={busy} onClick={toggleStatus}>
              {professional.status === "ACTIVE" ? (
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
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados do profissional</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <InfoRow icon={Tag} label="Especialidade" value={professional.specialty ?? "Não informada"} />
          <InfoRow icon={Phone} label="Telefone" value={professional.phone ?? "Não informado"} />
          <InfoRow icon={Mail} label="E-mail" value={professional.email ?? "Não informado"} />
          <InfoRow icon={CalendarClock} label="Criado em" value={formatDateTime(professional.createdAt)} />
        </CardContent>
      </Card>

      <WorkingHoursManager
        professionalId={professional.id}
        workingHours={professional.workingHours}
        canManage={canManageWorkingHours}
      />

      <ProfessionalServicesManager
        professionalId={professional.id}
        linkedServices={professional.services}
        availableServices={availableServices}
        canManage={canManageServices}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="size-4.5 text-primary" />
            Consultas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Consultas e a agenda deste profissional aparecerão aqui nas próximas etapas.
          </p>
        </CardContent>
      </Card>

      <ProfessionalFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode="edit"
        initial={{
          id: professional.id,
          name: professional.name,
          email: professional.email ?? "",
          phone: professional.phone ?? "",
          specialty: professional.specialty ?? "",
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
