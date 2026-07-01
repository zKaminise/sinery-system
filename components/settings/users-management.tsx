"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  MoreVertical,
  UserPlus,
  Pencil,
  KeyRound,
  UserCheck,
  UserX,
  Copy,
  TriangleAlert,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { UserFormDialog, roleLabels } from "@/components/settings/user-form-dialog"
import type { SettingsCurrentUser, SettingsUser } from "@/components/settings/types"
import type { UserRole, UserStatus } from "@/lib/generated/prisma/client"

const roleStyles: Record<UserRole, string> = {
  OWNER: "bg-primary/10 text-primary",
  ADMIN: "bg-secondary/10 text-secondary",
  RECEPTIONIST: "bg-muted text-muted-foreground",
  PROFESSIONAL: "bg-muted text-muted-foreground",
}

const statusLabels: Record<UserStatus, string> = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  INVITED: "Convidado",
}

const statusStyles: Record<UserStatus, string> = {
  ACTIVE: "bg-success/10 text-success",
  INACTIVE: "bg-muted text-muted-foreground",
  INVITED: "bg-warning/10 text-warning",
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(iso))
}

export function UsersManagement({
  currentUser,
  users,
}: {
  currentUser: SettingsCurrentUser
  users: SettingsUser[]
}) {
  const router = useRouter()
  const [formOpen, setFormOpen] = React.useState(false)
  const [formMode, setFormMode] = React.useState<"create" | "edit">("create")
  const [formInitial, setFormInitial] = React.useState<
    { id: string; name: string; role: UserRole } | undefined
  >(undefined)
  const [revealedPassword, setRevealedPassword] = React.useState<string | null>(null)
  const [busyId, setBusyId] = React.useState<string | null>(null)

  const isAdmin = currentUser.role === "ADMIN"

  function canEditRow(u: SettingsUser) {
    return !(isAdmin && u.role === "OWNER")
  }
  function canToggleRow(u: SettingsUser) {
    return u.id !== currentUser.id && !(isAdmin && u.role === "OWNER")
  }

  function openCreate() {
    setFormMode("create")
    setFormInitial(undefined)
    setFormOpen(true)
  }
  function openEdit(u: SettingsUser) {
    setFormMode("edit")
    setFormInitial({ id: u.id, name: u.name, role: u.role })
    setFormOpen(true)
  }

  async function toggleStatus(u: SettingsUser) {
    const nextStatus: UserStatus = u.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
    setBusyId(u.id)
    try {
      const response = await fetch(`/api/settings/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status", status: nextStatus }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.error?.message ?? "Não foi possível alterar o status.")
        return
      }
      toast.success(nextStatus === "ACTIVE" ? "Usuário ativado." : "Usuário inativado.")
      router.refresh()
    } catch {
      toast.error("Erro de conexão. Tente novamente.")
    } finally {
      setBusyId(null)
    }
  }

  async function resetPassword(u: SettingsUser) {
    setBusyId(u.id)
    try {
      const response = await fetch(`/api/settings/users/${u.id}/reset-password`, {
        method: "POST",
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.error?.message ?? "Não foi possível redefinir a senha.")
        return
      }
      setRevealedPassword(data.data.provisionalPassword as string)
      router.refresh()
    } catch {
      toast.error("Erro de conexão. Tente novamente.")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {users.length} {users.length === 1 ? "usuário" : "usuários"} nesta clínica.
        </p>
        <Button onClick={openCreate}>
          <UserPlus className="size-4" />
          Criar usuário
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <Table className="min-w-[860px]">
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Função</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Senha provisória</TableHead>
              <TableHead>Primeiro login</TableHead>
              <TableHead>Últ. troca de senha</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => {
              const isSelf = u.id === currentUser.id
              const showEdit = canEditRow(u)
              const showToggle = canToggleRow(u)
              const showReset = canEditRow(u)
              const hasActions = showEdit || showToggle || showReset
              return (
                <TableRow key={u.id}>
                  <TableCell className="font-medium text-foreground">
                    {u.name}
                    {isSelf && (
                      <span className="ml-1.5 text-xs text-muted-foreground">(você)</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("border-transparent", roleStyles[u.role])}>
                      {roleLabels[u.role]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("border-transparent", statusStyles[u.status])}>
                      {statusLabels[u.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {u.temporaryPassword ? (
                      <span className="inline-flex items-center gap-1 text-xs text-warning">
                        <TriangleAlert className="size-3.5" /> Sim
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Não</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(u.firstLoginAt)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(u.passwordChangedAt)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(u.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    {hasActions ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon" aria-label="Ações do usuário"
                              disabled={busyId === u.id}>
                              <MoreVertical className="size-4" />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end" className="w-52">
                          {showEdit && (
                            <DropdownMenuItem onClick={() => openEdit(u)}>
                              <Pencil className="size-4" /> Editar
                            </DropdownMenuItem>
                          )}
                          {showToggle && (
                            <DropdownMenuItem onClick={() => toggleStatus(u)}>
                              {u.status === "ACTIVE" ? (
                                <>
                                  <UserX className="size-4" /> Inativar
                                </>
                              ) : (
                                <>
                                  <UserCheck className="size-4" /> Ativar
                                </>
                              )}
                            </DropdownMenuItem>
                          )}
                          {showReset && (
                            <DropdownMenuItem onClick={() => resetPassword(u)}>
                              <KeyRound className="size-4" /> Redefinir senha provisória
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <span className="text-muted-foreground/60">—</span>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Usuários inativos não conseguem acessar o sistema. Não há exclusão permanente de
        usuários — utilize a inativação.
      </p>

      <UserFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        actorRole={currentUser.role}
        initial={formInitial}
        onCreated={(pwd) => setRevealedPassword(pwd)}
        onUpdated={() => router.refresh()}
      />

      <ProvisionalPasswordDialog
        password={revealedPassword}
        onClose={() => setRevealedPassword(null)}
      />
    </div>
  )
}

function ProvisionalPasswordDialog({
  password,
  onClose,
}: {
  password: string | null
  onClose: () => void
}) {
  async function copy() {
    if (!password) return
    try {
      await navigator.clipboard.writeText(password)
      toast.success("Senha copiada.")
    } catch {
      toast.error("Não foi possível copiar automaticamente. Copie manualmente.")
    }
  }

  return (
    <Dialog open={password !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Senha provisória criada</DialogTitle>
          <DialogDescription>
            Essa senha será exibida apenas uma vez. Copie e envie para o usuário de forma
            segura. Ele deverá trocá-la no primeiro acesso.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
          <code className="text-sm font-medium text-foreground">{password}</code>
          <Button variant="outline" size="sm" onClick={copy}>
            <Copy className="size-4" /> Copiar
          </Button>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Concluído</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
