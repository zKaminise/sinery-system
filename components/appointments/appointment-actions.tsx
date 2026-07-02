"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { MoreVertical, Eye, Pencil, CheckCircle2, XCircle, CircleCheck, UserX } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { canTransitionStatus, isTerminalStatus } from "@/lib/appointments/availability"
import type { AppointmentItem } from "@/components/appointments/types"
import type { AppointmentStatus } from "@/lib/generated/prisma/client"

interface AppointmentActionsProps {
  appointment: AppointmentItem
  canManage: boolean
  onEdit: (appointment: AppointmentItem) => void
}

export function AppointmentActions({ appointment, canManage, onEdit }: AppointmentActionsProps) {
  const router = useRouter()
  const [busy, setBusy] = React.useState(false)

  async function changeStatus(status: AppointmentStatus, successMsg: string) {
    setBusy(true)
    try {
      const response = await fetch(`/api/appointments/${appointment.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.error?.message ?? "Não foi possível atualizar a consulta.")
        return
      }
      toast.success(successMsg)
      router.refresh()
    } catch {
      toast.error("Erro de conexão. Tente novamente.")
    } finally {
      setBusy(false)
    }
  }

  const status = appointment.status
  const canEdit = canManage && !isTerminalStatus(status)
  const canConfirm = canManage && canTransitionStatus(status, "CONFIRMED")
  const canCancel = canManage && canTransitionStatus(status, "CANCELLED")
  const canComplete = canManage && canTransitionStatus(status, "COMPLETED")
  const canNoShow = canManage && canTransitionStatus(status, "NO_SHOW")

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Ações da consulta" disabled={busy}>
            <MoreVertical className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem render={<Link href={`/agenda/${appointment.id}`} />}>
          <Eye className="size-4" /> Ver detalhes
        </DropdownMenuItem>

        {canEdit && (
          <DropdownMenuItem onClick={() => onEdit(appointment)}>
            <Pencil className="size-4" /> Editar / remarcar
          </DropdownMenuItem>
        )}

        {(canConfirm || canComplete || canCancel || canNoShow) && <DropdownMenuSeparator />}

        {canConfirm && (
          <DropdownMenuItem onClick={() => changeStatus("CONFIRMED", "Consulta confirmada.")}>
            <CheckCircle2 className="size-4" /> Confirmar
          </DropdownMenuItem>
        )}
        {canComplete && (
          <DropdownMenuItem onClick={() => changeStatus("COMPLETED", "Consulta concluída.")}>
            <CircleCheck className="size-4" /> Concluir
          </DropdownMenuItem>
        )}
        {canNoShow && (
          <DropdownMenuItem onClick={() => changeStatus("NO_SHOW", "Falta registrada.")}>
            <UserX className="size-4" /> Marcar falta
          </DropdownMenuItem>
        )}
        {canCancel && (
          <DropdownMenuItem
            variant="destructive"
            onClick={() => changeStatus("CANCELLED", "Consulta cancelada.")}
          >
            <XCircle className="size-4" /> Cancelar
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
