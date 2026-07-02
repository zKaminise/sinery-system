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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { suggestedDurations } from "@/lib/validators/service"

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 dark:bg-input/30"

export interface ServiceFormValues {
  name: string
  description: string
  durationMinutes: string
  priceInReais: string
}

const emptyForm: ServiceFormValues = { name: "", description: "", durationMinutes: "30", priceInReais: "" }

interface ServiceFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  initial?: { id: string } & Partial<ServiceFormValues>
  onSaved: () => void
}

export function ServiceFormDialog({
  open,
  onOpenChange,
  mode,
  initial,
  onSaved,
}: ServiceFormDialogProps) {
  const [form, setForm] = React.useState<ServiceFormValues>(emptyForm)
  const [loading, setLoading] = React.useState(false)

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  React.useEffect(() => {
    if (open) {
      setForm({
        name: initial?.name ?? "",
        description: initial?.description ?? "",
        durationMinutes: initial?.durationMinutes ?? "30",
        priceInReais: initial?.priceInReais ?? "",
      })
      setLoading(false)
    }
  }, [open])
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  function set<K extends keyof ServiceFormValues>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    try {
      const url = mode === "create" ? "/api/services" : `/api/services/${initial?.id}`
      const method = mode === "create" ? "POST" : "PATCH"

      const payload = {
        name: form.name,
        description: form.description,
        durationMinutes: Number(form.durationMinutes),
        priceInReais: form.priceInReais.trim() === "" ? undefined : Number(form.priceInReais),
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        toast.error(data?.error?.message ?? "Não foi possível salvar o serviço.")
        return
      }

      toast.success(mode === "create" ? "Serviço cadastrado." : "Serviço atualizado.")
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
          <DialogTitle>{mode === "create" ? "Novo serviço" : "Editar serviço"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Cadastre um serviço ou procedimento oferecido pela clínica."
              : "Atualize os dados deste serviço."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="sv-name">Nome</Label>
              <Input id="sv-name" value={form.name} required disabled={loading}
                onChange={(e) => set("name", e.target.value)} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sv-duration">Duração (minutos)</Label>
              <select id="sv-duration" className={selectClass} value={form.durationMinutes} disabled={loading}
                onChange={(e) => set("durationMinutes", e.target.value)}>
                {suggestedDurations.map((d) => (
                  <option key={d} value={d}>{d} minutos</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sv-price">Preço estimado (R$)</Label>
              <Input id="sv-price" type="number" min="0" step="0.01" value={form.priceInReais} disabled={loading}
                placeholder="150.00" onChange={(e) => set("priceInReais", e.target.value)} />
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="sv-description">Descrição</Label>
              <Textarea id="sv-description" value={form.description} disabled={loading} rows={3}
                onChange={(e) => set("description", e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {mode === "create" ? "Cadastrar serviço" : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
