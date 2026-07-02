"use client"

import * as React from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { daysOfWeek, dayOfWeekLabels } from "@/lib/validators/working-hour"
import type { ProfessionalWorkingHour } from "@/components/professionals/types"

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 dark:bg-input/30"

interface WorkingHourFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  professionalId: string
  initial?: ProfessionalWorkingHour
  onSaved: () => void
}

export function WorkingHourFormDialog({
  open,
  onOpenChange,
  professionalId,
  initial,
  onSaved,
}: WorkingHourFormDialogProps) {
  const [dayOfWeek, setDayOfWeek] = React.useState(1)
  const [startTime, setStartTime] = React.useState("08:00")
  const [endTime, setEndTime] = React.useState("12:00")
  const [active, setActive] = React.useState(true)
  const [loading, setLoading] = React.useState(false)

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  React.useEffect(() => {
    if (open) {
      setDayOfWeek(initial?.dayOfWeek ?? 1)
      setStartTime(initial?.startTime ?? "08:00")
      setEndTime(initial?.endTime ?? "12:00")
      setActive(initial?.active ?? true)
      setLoading(false)
    }
  }, [open])
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    try {
      const url = initial
        ? `/api/professionals/${professionalId}/working-hours/${initial.id}`
        : `/api/professionals/${professionalId}/working-hours`
      const method = initial ? "PATCH" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayOfWeek, startTime, endTime, active }),
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        toast.error(data?.error?.message ?? "Não foi possível salvar o horário.")
        return
      }

      toast.success(initial ? "Horário atualizado." : "Horário criado.")
      onOpenChange(false)
      onSaved()
    } catch {
      toast.error("Erro de conexão. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar horário" : "Adicionar horário"}</DialogTitle>
          <DialogDescription>
            Configure os dias e horários em que este profissional atende. Essas
            informações serão usadas pela agenda e pela Sinery Assist.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="wh-day">Dia da semana</Label>
            <select
              id="wh-day"
              className={selectClass}
              value={dayOfWeek}
              disabled={loading}
              onChange={(e) => setDayOfWeek(Number(e.target.value))}
            >
              {daysOfWeek.map((day) => (
                <option key={day} value={day}>{dayOfWeekLabels[day]}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wh-start">Início</Label>
              <input
                id="wh-start"
                type="time"
                className={selectClass}
                value={startTime}
                disabled={loading}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wh-end">Término</Label>
              <input
                id="wh-end"
                type="time"
                className={selectClass}
                value={endTime}
                disabled={loading}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
            <span className="text-sm font-medium text-foreground">Horário ativo</span>
            <Switch checked={active} disabled={loading} onCheckedChange={setActive} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {initial ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
