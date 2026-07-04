"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Mail } from "lucide-react"

import { Button } from "@/components/ui/button"

export function ResendAccessButton({ clinicId }: { clinicId: string }) {
  const router = useRouter()
  const [busy, setBusy] = React.useState(false)

  async function resend() {
    if (!confirm("Gerar uma NOVA senha provisória e enviar por e-mail ao OWNER?")) return
    setBusy(true)
    try {
      const res = await fetch(`/api/founder/clinics/${clinicId}/resend-access`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) toast.error(data.error ?? "Falha ao reenviar.")
      else {
        toast.success(
          data.data?.emailStatus === "SENT"
            ? "Nova senha enviada ao OWNER por e-mail."
            : "Nova senha gerada (e-mail em modo mock — veja EmailLog)."
        )
        router.refresh()
      }
    } catch {
      toast.error("Erro de conexão.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button size="sm" variant="outline" disabled={busy} onClick={resend}>
      <Mail className="size-4" />
      Reenviar acesso
    </Button>
  )
}
