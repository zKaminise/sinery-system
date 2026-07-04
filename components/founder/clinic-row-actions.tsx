"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Pause, Play, RefreshCw, Copy } from "lucide-react"

import { Button } from "@/components/ui/button"

export function ClinicRowActions({
  clinicId,
  status,
  url,
  name,
}: {
  clinicId: string
  status: string
  url: string
  name: string
}) {
  const router = useRouter()
  const [busy, setBusy] = React.useState(false)

  async function act(action: "suspend" | "reactivate" | "recalculate") {
    setBusy(true)
    try {
      const res = await fetch(`/api/founder/clinics/${clinicId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Falha na ação.")
      } else {
        toast.success(
          action === "suspend" ? "Clínica suspensa." : action === "reactivate" ? "Clínica liberada." : `Status recalculado: ${data.data?.clinicStatus ?? "ok"}.`
        )
        router.refresh()
      }
    } catch {
      toast.error("Erro de conexão.")
    } finally {
      setBusy(false)
    }
  }

  function copyAccess() {
    const message = `Olá! Seu acesso ao Sinery System (${name}) está disponível em ${url}. Use o e-mail do responsável e a senha provisória fornecida. No primeiro acesso será necessário trocar a senha.`
    navigator.clipboard?.writeText(message)
    toast.success("Mensagem de acesso copiada.")
  }

  return (
    <div className="flex items-center gap-1">
      {status === "SUSPENDED" ? (
        <Button size="icon" variant="ghost" title="Liberar" disabled={busy} onClick={() => act("reactivate")}>
          <Play className="size-4 text-success" />
        </Button>
      ) : (
        <Button size="icon" variant="ghost" title="Suspender" disabled={busy} onClick={() => act("suspend")}>
          <Pause className="size-4 text-destructive" />
        </Button>
      )}
      <Button size="icon" variant="ghost" title="Recalcular status" disabled={busy} onClick={() => act("recalculate")}>
        <RefreshCw className="size-4" />
      </Button>
      <Button size="icon" variant="ghost" title="Copiar mensagem de acesso" onClick={copyAccess}>
        <Copy className="size-4" />
      </Button>
    </div>
  )
}
