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

export interface ProfessionalFormValues {
  name: string
  email: string
  phone: string
  specialty: string
}

const emptyForm: ProfessionalFormValues = { name: "", email: "", phone: "", specialty: "" }

interface ProfessionalFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  initial?: { id: string } & Partial<ProfessionalFormValues>
  onSaved: () => void
}

export function ProfessionalFormDialog({
  open,
  onOpenChange,
  mode,
  initial,
  onSaved,
}: ProfessionalFormDialogProps) {
  const [form, setForm] = React.useState<ProfessionalFormValues>(emptyForm)
  const [loading, setLoading] = React.useState(false)

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  React.useEffect(() => {
    if (open) {
      setForm({
        name: initial?.name ?? "",
        email: initial?.email ?? "",
        phone: initial?.phone ?? "",
        specialty: initial?.specialty ?? "",
      })
      setLoading(false)
    }
  }, [open])
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  function set<K extends keyof ProfessionalFormValues>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    try {
      const url = mode === "create" ? "/api/professionals" : `/api/professionals/${initial?.id}`
      const method = mode === "create" ? "POST" : "PATCH"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        toast.error(data?.error?.message ?? "Não foi possível salvar o profissional.")
        return
      }

      toast.success(mode === "create" ? "Profissional cadastrado." : "Profissional atualizado.")
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
          <DialogTitle>{mode === "create" ? "Novo profissional" : "Editar profissional"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Cadastre um novo profissional da sua clínica."
              : "Atualize os dados cadastrais deste profissional."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="pr-name">Nome</Label>
              <Input id="pr-name" value={form.name} required disabled={loading}
                onChange={(e) => set("name", e.target.value)} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pr-specialty">Especialidade</Label>
              <Input id="pr-specialty" value={form.specialty} disabled={loading}
                placeholder="Ortodontia, Endodontia..." onChange={(e) => set("specialty", e.target.value)} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pr-phone">Telefone</Label>
              <Input id="pr-phone" value={form.phone} disabled={loading}
                placeholder="(11) 99999-0000" onChange={(e) => set("phone", e.target.value)} />
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="pr-email">E-mail</Label>
              <Input id="pr-email" type="email" value={form.email} disabled={loading}
                onChange={(e) => set("email", e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {mode === "create" ? "Cadastrar profissional" : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
