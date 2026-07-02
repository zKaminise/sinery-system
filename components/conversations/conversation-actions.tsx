"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Headset,
  ArrowRightLeft,
  Sparkles,
  CheckCircle2,
  RotateCcw,
  MoreVertical,
  UserPlus,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { canPerformConversationAction, type ConversationAction } from "@/lib/conversations/constants"
import type { ConversationStatus } from "@/lib/generated/prisma/client"

interface ConversationActionsProps {
  conversationId: string
  status: ConversationStatus
  canAssignOthers: boolean
  users: { id: string; name: string }[]
}

export function ConversationActions({
  conversationId,
  status,
  canAssignOthers,
  users,
}: ConversationActionsProps) {
  const router = useRouter()
  const [busy, setBusy] = React.useState(false)

  async function runAction(action: ConversationAction, assignedUserId?: string, successMsg?: string) {
    setBusy(true)
    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, assignedUserId }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.error?.message ?? "Não foi possível atualizar a conversa.")
        return
      }
      toast.success(successMsg ?? "Conversa atualizada.")
      router.refresh()
    } catch {
      toast.error("Erro de conexão. Tente novamente.")
    } finally {
      setBusy(false)
    }
  }

  const showTake = canPerformConversationAction("take", status)
  const showReopen = canPerformConversationAction("reopen", status)
  const showTransfer = canPerformConversationAction("transfer", status)
  const showReturnAI = canPerformConversationAction("return_to_ai", status)
  const showClose = canPerformConversationAction("close", status)
  const showAssign = canAssignOthers && canPerformConversationAction("assign", status) && users.length > 0

  return (
    <div className="flex items-center gap-1.5">
      {showTake && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => runAction("take", undefined, "Atendimento assumido.")}>
          <Headset className="size-4" /> Assumir
        </Button>
      )}
      {showReopen && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => runAction("reopen", undefined, "Conversa reaberta.")}>
          <RotateCcw className="size-4" /> Reabrir
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label="Mais ações" disabled={busy}>
              <MoreVertical className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-56">
          {showTransfer && (
            <DropdownMenuItem onClick={() => runAction("transfer", undefined, "Conversa transferida para atendimento humano.")}>
              <ArrowRightLeft className="size-4" /> Transferir para humano
            </DropdownMenuItem>
          )}
          {showReturnAI && (
            <DropdownMenuItem onClick={() => runAction("return_to_ai", undefined, "Conversa devolvida para Sinery Assist.")}>
              <Sparkles className="size-4" /> Devolver para Sinery Assist
            </DropdownMenuItem>
          )}
          {showClose && (
            <DropdownMenuItem variant="destructive" onClick={() => runAction("close", undefined, "Conversa encerrada.")}>
              <CheckCircle2 className="size-4" /> Encerrar conversa
            </DropdownMenuItem>
          )}

          {showAssign && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="flex items-center gap-1.5">
                <UserPlus className="size-3.5" /> Atribuir responsável
              </DropdownMenuLabel>
              {users.map((u) => (
                <DropdownMenuItem
                  key={u.id}
                  onClick={() => runAction("assign", u.id, `Conversa atribuída a ${u.name}.`)}
                >
                  {u.name}
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
