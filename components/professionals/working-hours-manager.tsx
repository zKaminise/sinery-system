"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Clock, Plus, Pencil, Trash2 } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { dayOfWeekLabels } from "@/lib/validators/working-hour"
import { WorkingHourFormDialog } from "@/components/professionals/working-hour-form-dialog"
import type { ProfessionalWorkingHour } from "@/components/professionals/types"

// Displayed Monday-first (a natural work-week reading), even though
// dayOfWeek is stored using JS's 0=Sunday convention internally.
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

interface WorkingHoursManagerProps {
  professionalId: string
  workingHours: ProfessionalWorkingHour[]
  canManage: boolean
}

export function WorkingHoursManager({
  professionalId,
  workingHours,
  canManage,
}: WorkingHoursManagerProps) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<ProfessionalWorkingHour | undefined>(undefined)
  const [busyId, setBusyId] = React.useState<string | null>(null)

  function openCreate() {
    setEditing(undefined)
    setDialogOpen(true)
  }

  function openEdit(wh: ProfessionalWorkingHour) {
    setEditing(wh)
    setDialogOpen(true)
  }

  async function toggleActive(wh: ProfessionalWorkingHour) {
    setBusyId(wh.id)
    try {
      const response = await fetch(`/api/professionals/${professionalId}/working-hours/${wh.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dayOfWeek: wh.dayOfWeek,
          startTime: wh.startTime,
          endTime: wh.endTime,
          active: !wh.active,
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.error?.message ?? "Não foi possível atualizar o horário.")
        return
      }
      toast.success(wh.active ? "Horário inativado." : "Horário ativado.")
      router.refresh()
    } catch {
      toast.error("Erro de conexão. Tente novamente.")
    } finally {
      setBusyId(null)
    }
  }

  async function removeWorkingHour(wh: ProfessionalWorkingHour) {
    if (!window.confirm("Remover este horário de atendimento?")) return
    setBusyId(wh.id)
    try {
      const response = await fetch(`/api/professionals/${professionalId}/working-hours/${wh.id}`, {
        method: "DELETE",
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.error?.message ?? "Não foi possível remover o horário.")
        return
      }
      toast.success("Horário removido.")
      router.refresh()
    } catch {
      toast.error("Erro de conexão. Tente novamente.")
    } finally {
      setBusyId(null)
    }
  }

  const byDay = new Map<number, ProfessionalWorkingHour[]>()
  for (const wh of workingHours) {
    const list = byDay.get(wh.dayOfWeek) ?? []
    list.push(wh)
    byDay.set(wh.dayOfWeek, list)
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => a.startTime.localeCompare(b.startTime))
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Clock className="size-4.5 text-primary" />
            Horários de atendimento
          </CardTitle>
          <CardDescription>
            Configure os dias e horários em que este profissional atende. Essas
            informações serão usadas pela agenda e pela Sinery Assist.
          </CardDescription>
        </div>
        {canManage && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4" /> Adicionar horário
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {workingHours.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum horário configurado ainda.
          </p>
        ) : (
          DISPLAY_ORDER.filter((day) => byDay.has(day)).map((day) => (
            <div key={day} className="flex flex-col gap-2">
              <p className="text-sm font-medium text-foreground">{dayOfWeekLabels[day]}</p>
              <div className="flex flex-col gap-1.5">
                {byDay.get(day)!.map((wh) => (
                  <div
                    key={wh.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                  >
                    <span className={`text-sm ${wh.active ? "text-foreground" : "text-muted-foreground line-through"}`}>
                      {wh.startTime} – {wh.endTime}
                    </span>
                    {canManage ? (
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={wh.active}
                          disabled={busyId === wh.id}
                          onCheckedChange={() => toggleActive(wh)}
                          aria-label="Ativar/inativar horário"
                        />
                        <Button variant="ghost" size="icon" disabled={busyId === wh.id} onClick={() => openEdit(wh)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" disabled={busyId === wh.id} onClick={() => removeWorkingHour(wh)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {wh.active ? "Ativo" : "Inativo"}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </CardContent>

      {canManage && (
        <WorkingHourFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          professionalId={professionalId}
          initial={editing}
          onSaved={() => router.refresh()}
        />
      )}
    </Card>
  )
}
