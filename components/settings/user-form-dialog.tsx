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
import { assignableRoles } from "@/lib/permissions"
import type { UserRole } from "@/lib/generated/prisma/client"

export const roleLabels: Record<UserRole, string> = {
  OWNER: "Proprietário",
  ADMIN: "Administrador",
  RECEPTIONIST: "Recepção",
  PROFESSIONAL: "Profissional",
}

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 dark:bg-input/30"

interface UserFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  actorRole: UserRole
  initial?: { id: string; name: string; role: UserRole }
  onCreated: (provisionalPassword: string) => void
  onUpdated: () => void
}

export function UserFormDialog({
  open,
  onOpenChange,
  mode,
  actorRole,
  initial,
  onCreated,
  onUpdated,
}: UserFormDialogProps) {
  const roles = assignableRoles(actorRole)
  // In edit mode the target may hold a role the actor can't assign (e.g. OWNER);
  // keep it visible/selected so we never silently change it.
  const roleOptions =
    initial && !roles.includes(initial.role) ? [initial.role, ...roles] : roles

  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [role, setRole] = React.useState<UserRole>(roles[0] ?? "RECEPTIONIST")
  const [loading, setLoading] = React.useState(false)

  // Reset fields whenever the dialog opens (sync form state to the target).
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  React.useEffect(() => {
    if (open) {
      setName(initial?.name ?? "")
      setEmail("")
      setRole(initial?.role ?? roles[0] ?? "RECEPTIONIST")
      setLoading(false)
    }
  }, [open])
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    try {
      if (mode === "create") {
        const response = await fetch("/api/settings/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, role }),
        })
        const data = await response.json().catch(() => null)
        if (!response.ok) {
          toast.error(data?.error?.message ?? "Não foi possível criar o usuário.")
          return
        }
        onOpenChange(false)
        onCreated(data.data.provisionalPassword as string)
      } else if (initial) {
        const response = await fetch(`/api/settings/users/${initial.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "update", name, role }),
        })
        const data = await response.json().catch(() => null)
        if (!response.ok) {
          toast.error(data?.error?.message ?? "Não foi possível atualizar o usuário.")
          return
        }
        toast.success("Usuário atualizado.")
        onOpenChange(false)
        onUpdated()
      }
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
          <DialogTitle>{mode === "create" ? "Novo usuário" : "Editar usuário"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Uma senha provisória será gerada e exibida apenas uma vez."
              : "Atualize o nome e a função deste usuário."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="user-name">Nome</Label>
            <Input id="user-name" value={name} required disabled={loading}
              onChange={(e) => setName(e.target.value)} />
          </div>

          {mode === "create" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="user-email">E-mail</Label>
              <Input id="user-email" type="email" value={email} required disabled={loading}
                placeholder="usuario@clinica.com.br" onChange={(e) => setEmail(e.target.value)} />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="user-role">Função</Label>
            <select id="user-role" className={selectClass} value={role} disabled={loading}
              onChange={(e) => setRole(e.target.value as UserRole)}>
              {roleOptions.map((r) => (
                <option key={r} value={r}>{roleLabels[r]}</option>
              ))}
            </select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {mode === "create" ? "Criar usuário" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
