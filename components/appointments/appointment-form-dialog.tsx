"use client"

import * as React from "react"
import Link from "next/link"
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
import { Textarea } from "@/components/ui/textarea"
import type { AgendaFormOptions, AppointmentEditValues } from "@/components/appointments/types"

const fieldClass =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 dark:bg-input/30"

/** Adds `minutes` to an "HH:mm" string, clamping at 23:59. */
function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return time
  const total = Math.min(h * 60 + m + minutes, 23 * 60 + 59)
  const nh = Math.floor(total / 60)
  const nm = total % 60
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`
}

interface AppointmentFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  options: AgendaFormOptions
  /** Default date to prefill on create (the currently-viewed agenda date). */
  defaultDate: string
  initial?: AppointmentEditValues
  onSaved: () => void
}

export function AppointmentFormDialog({
  open,
  onOpenChange,
  mode,
  options,
  defaultDate,
  initial,
  onSaved,
}: AppointmentFormDialogProps) {
  const [patientId, setPatientId] = React.useState("")
  const [professionalId, setProfessionalId] = React.useState("")
  const [serviceId, setServiceId] = React.useState("")
  const [date, setDate] = React.useState(defaultDate)
  const [startTime, setStartTime] = React.useState("08:00")
  const [endTime, setEndTime] = React.useState("08:30")
  const [notes, setNotes] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  // Tracks whether the user manually edited endTime, so auto-duration from a
  // service selection doesn't clobber a deliberate manual value.
  const endTouchedRef = React.useRef(false)

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  React.useEffect(() => {
    if (open) {
      setPatientId(initial?.patientId ?? "")
      setProfessionalId(initial?.professionalId ?? "")
      setServiceId(initial?.serviceId ?? "")
      setDate(initial?.date ?? defaultDate)
      setStartTime(initial?.startTime ?? "08:00")
      setEndTime(initial?.endTime ?? "08:30")
      setNotes(initial?.notes ?? "")
      setLoading(false)
      endTouchedRef.current = mode === "edit"
    }
  }, [open])
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  const linkedServices = professionalId
    ? options.servicesByProfessional[professionalId] ?? []
    : []

  function handleProfessionalChange(value: string) {
    setProfessionalId(value)
    // Reset service when switching professional (link set differs).
    setServiceId("")
  }

  function applyDuration(nextServiceId: string, fromStart: string) {
    const svc = linkedServices.find((s) => s.id === nextServiceId)
    const minutes = svc ? svc.durationMinutes : options.defaultSlotMinutes
    if (!endTouchedRef.current) {
      setEndTime(addMinutes(fromStart, minutes))
    }
  }

  function handleServiceChange(value: string) {
    setServiceId(value)
    applyDuration(value, startTime)
  }

  function handleStartChange(value: string) {
    setStartTime(value)
    if (!endTouchedRef.current) {
      applyDuration(serviceId, value)
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    try {
      const url = mode === "create" ? "/api/appointments" : `/api/appointments/${initial?.id}`
      const method = mode === "create" ? "POST" : "PATCH"
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          professionalId,
          serviceId: serviceId || undefined,
          date,
          startTime,
          endTime,
          notes,
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.error?.message ?? "Não foi possível salvar a consulta.")
        return
      }
      toast.success(mode === "create" ? "Consulta criada." : "Consulta atualizada.")
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Nova consulta" : "Editar / remarcar consulta"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Agende uma consulta respeitando os horários e serviços do profissional."
              : "Ajuste os dados da consulta. Mudar data, horário ou profissional conta como remarcação."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ap-patient">Paciente</Label>
            <select id="ap-patient" className={fieldClass} value={patientId} required disabled={loading}
              onChange={(e) => setPatientId(e.target.value)}>
              <option value="">Selecione um paciente...</option>
              {options.patients.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <Link href="/pacientes" className="w-fit text-xs text-muted-foreground hover:text-foreground">
              Gerenciar pacientes
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ap-professional">Profissional</Label>
              <select id="ap-professional" className={fieldClass} value={professionalId} required disabled={loading}
                onChange={(e) => handleProfessionalChange(e.target.value)}>
                <option value="">Selecione...</option>
                {options.professionals.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ap-service">Serviço</Label>
              <select id="ap-service" className={fieldClass} value={serviceId} disabled={loading || !professionalId}
                onChange={(e) => handleServiceChange(e.target.value)}>
                <option value="">Sem serviço específico</option>
                {linkedServices.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.durationMinutes} min)</option>
                ))}
              </select>
              {professionalId && linkedServices.length === 0 && (
                <p className="text-xs text-warning">
                  Este profissional ainda não possui serviços vinculados.
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ap-date">Data</Label>
              <input id="ap-date" type="date" className={fieldClass} value={date} required disabled={loading}
                onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ap-start">Início</Label>
              <input id="ap-start" type="time" className={fieldClass} value={startTime} required disabled={loading}
                onChange={(e) => handleStartChange(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ap-end">Término</Label>
              <input id="ap-end" type="time" className={fieldClass} value={endTime} required disabled={loading}
                onChange={(e) => { endTouchedRef.current = true; setEndTime(e.target.value) }} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ap-notes">Observações</Label>
            <Textarea id="ap-notes" value={notes} disabled={loading} rows={2}
              onChange={(e) => setNotes(e.target.value)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {mode === "create" ? "Criar consulta" : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
