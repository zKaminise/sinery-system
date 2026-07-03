"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const fieldClass =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 dark:bg-input/30"

interface NewSimulationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  patients: { id: string; name: string }[]
}

export function NewSimulationDialog({ open, onOpenChange, patients }: NewSimulationDialogProps) {
  const router = useRouter()
  const [patientId, setPatientId] = React.useState("")
  const [contactName, setContactName] = React.useState("")
  const [initialMessage, setInitialMessage] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  /* eslint-disable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    if (open) {
      setPatientId("")
      setContactName("")
      setInitialMessage("")
      setLoading(false)
    }
  }, [open])
  /* eslint-enable react-hooks/set-state-in-effect */

  const hasPatient = patientId.length > 0

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    try {
      const response = await fetch("/api/assist/simulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: patientId || undefined,
          contactName: hasPatient ? undefined : contactName,
          contactPhone: hasPatient ? undefined : "0000000000",
          initialMessage,
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.error?.message ?? "Não foi possível criar a simulação.")
        return
      }
      toast.success("Simulação criada.")
      onOpenChange(false)
      if (data?.data?.id) router.push(`/assist?c=${data.data.id}`)
      else router.refresh()
    } catch {
      toast.error("Erro de conexão. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova simulação</DialogTitle>
          <DialogDescription>
            Teste o atendimento da Sinery Assist digitando como se fosse o paciente. Para agendar,
            vincule um paciente cadastrado.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sim-patient">Paciente (recomendado para agendar)</Label>
            <select
              id="sim-patient"
              className={fieldClass}
              value={patientId}
              disabled={loading}
              onChange={(e) => setPatientId(e.target.value)}
            >
              <option value="">Sem paciente vinculado</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {!hasPatient && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sim-name">Nome do contato</Label>
              <Input
                id="sim-name"
                value={contactName}
                disabled={loading}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Ex.: Paciente Teste"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sim-message">Primeira mensagem do paciente</Label>
            <Textarea
              id="sim-message"
              value={initialMessage}
              disabled={loading}
              rows={3}
              maxLength={2000}
              onChange={(e) => setInitialMessage(e.target.value)}
              placeholder="Ex.: Quero marcar uma limpeza amanhã"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              Iniciar simulação
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
