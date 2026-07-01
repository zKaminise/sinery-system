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
import { patientSources } from "@/lib/validators/patient"

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 dark:bg-input/30"

export interface PatientFormValues {
  name: string
  phone: string
  email: string
  document: string
  birthDate: string
  source: string
  notes: string
}

const emptyForm: PatientFormValues = {
  name: "",
  phone: "",
  email: "",
  document: "",
  birthDate: "",
  source: "",
  notes: "",
}

interface PatientFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  initial?: { id: string } & Partial<PatientFormValues>
  onSaved: () => void
}

export function PatientFormDialog({
  open,
  onOpenChange,
  mode,
  initial,
  onSaved,
}: PatientFormDialogProps) {
  const [form, setForm] = React.useState<PatientFormValues>(emptyForm)
  const [loading, setLoading] = React.useState(false)

  // Load the target's current values (or reset to blank) each time the
  // dialog opens.
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  React.useEffect(() => {
    if (open) {
      setForm({
        name: initial?.name ?? "",
        phone: initial?.phone ?? "",
        email: initial?.email ?? "",
        document: initial?.document ?? "",
        birthDate: initial?.birthDate ?? "",
        source: initial?.source ?? "",
        notes: initial?.notes ?? "",
      })
      setLoading(false)
    }
  }, [open])
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  function set<K extends keyof PatientFormValues>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    try {
      const url =
        mode === "create" ? "/api/patients" : `/api/patients/${initial?.id}`
      const method = mode === "create" ? "POST" : "PATCH"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        toast.error(data?.error?.message ?? "Não foi possível salvar o paciente.")
        return
      }

      toast.success(mode === "create" ? "Paciente cadastrado." : "Paciente atualizado.")
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
          <DialogTitle>{mode === "create" ? "Novo paciente" : "Editar paciente"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Cadastre um novo paciente na sua clínica."
              : "Atualize os dados cadastrais deste paciente."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="p-name">Nome</Label>
              <Input id="p-name" value={form.name} required disabled={loading}
                onChange={(e) => set("name", e.target.value)} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-phone">Telefone</Label>
              <Input id="p-phone" value={form.phone} required disabled={loading}
                placeholder="(11) 99999-0000" onChange={(e) => set("phone", e.target.value)} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-email">E-mail</Label>
              <Input id="p-email" type="email" value={form.email} disabled={loading}
                onChange={(e) => set("email", e.target.value)} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-document">CPF/documento</Label>
              <Input id="p-document" value={form.document} disabled={loading}
                onChange={(e) => set("document", e.target.value)} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-birthDate">Data de nascimento</Label>
              <Input id="p-birthDate" type="date" value={form.birthDate} disabled={loading}
                onChange={(e) => set("birthDate", e.target.value)} />
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="p-source">Origem</Label>
              <select id="p-source" className={selectClass} value={form.source} disabled={loading}
                onChange={(e) => set("source", e.target.value)}>
                <option value="">Não informada</option>
                {patientSources.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="p-notes">Observações</Label>
              <Textarea id="p-notes" value={form.notes} disabled={loading} rows={3}
                onChange={(e) => set("notes", e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Use este campo apenas para informações administrativas. O prontuário
                clínico será tratado em um módulo específico no futuro.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {mode === "create" ? "Cadastrar paciente" : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
