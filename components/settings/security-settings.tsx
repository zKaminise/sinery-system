"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { CheckCircle2, KeyRound, ScrollText, LogOut, Loader2 } from "lucide-react"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { roleLabels } from "@/components/settings/user-form-dialog"
import { isOwnerOrAdmin } from "@/lib/permissions"
import type { SettingsCurrentUser } from "@/components/settings/types"
import type { UserRole } from "@/lib/generated/prisma/client"

const roleStyles: Record<UserRole, string> = {
  OWNER: "bg-primary/10 text-primary",
  ADMIN: "bg-secondary/10 text-secondary",
  RECEPTIONIST: "bg-muted text-muted-foreground",
  PROFESSIONAL: "bg-muted text-muted-foreground",
}

export function SecuritySettings({ currentUser }: { currentUser: SettingsCurrentUser }) {
  const [loggingOut, setLoggingOut] = React.useState(false)
  const canSeeAudit = isOwnerOrAdmin(currentUser.role)

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } catch {
      toast.error("Não foi possível encerrar a sessão.")
    } finally {
      window.location.href = "/login"
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Sua conta</CardTitle>
          <CardDescription>Informações da sessão atual.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Info label="Nome" value={currentUser.name} />
          <Info label="E-mail" value={currentUser.email} />
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Função</span>
            <Badge variant="outline" className={cn("w-fit border-transparent", roleStyles[currentUser.role])}>
              {roleLabels[currentUser.role]}
            </Badge>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Status da sessão</span>
            <span className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-success">
              <CheckCircle2 className="size-4" /> Sessão ativa
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Segurança</CardTitle>
          <CardDescription>Como o Sinery System protege o acesso à sua clínica.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <SecurityNote
            icon={KeyRound}
            title="Senha provisória"
            text="Novos usuários e senhas redefinidas exigem a troca obrigatória da senha no primeiro acesso."
          />
          <SecurityNote
            icon={ScrollText}
            title="Auditoria"
            text="Ações importantes (login, alterações de clínica e usuários) são registradas nos logs de auditoria."
          />

          <div className="flex flex-wrap gap-2 pt-1">
            {canSeeAudit && (
              <Button
                variant="outline"
                nativeButton={false}
                render={
                  <Link href="/auditoria">
                    <ScrollText className="size-4" /> Ver auditoria
                  </Link>
                }
              />
            )}
            <Button variant="destructive" onClick={handleLogout} disabled={loggingOut}>
              {loggingOut ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
              Sair da conta
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  )
}

function SecurityNote({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  text: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border px-3 py-2.5">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" />
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-medium text-foreground">{title}</span>
        <span className="text-sm text-muted-foreground">{text}</span>
      </div>
    </div>
  )
}
