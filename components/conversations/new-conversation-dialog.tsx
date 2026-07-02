"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
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
import { conversationStatusLabels } from "@/lib/conversations/constants"
import { conversationStatusValues } from "@/lib/validators/conversation"

const fieldClass =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 dark:bg-input/30"

interface NewConversationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  patients: { id: string; name: string; phone: string }[]
}

export function NewConversationDialog({ open, onOpenChange, patients }: NewConversationDialogProps) {
  const router = useRouter()
  const [patientId, setPatientId] = React.useState("")
  const [contactName, setContactName] = React.useState("")
  const [contactPhone, setContactPhone] = React.useState("")
  const [initialMessage, setInitialMessage] = React.useState("")
  const [status, setStatus] = React.useState<string>("WAITING_HUMAN")
  const [loading, setLoading] = React.useState(false)

  /* eslint-disable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    if (open) {
      setPatientId("")
      setContactName("")
      setContactPhone("")
      setInitialMessage("")
      setStatus("WAITING_HUMAN")
      setLoading(false)
    }
  }, [open])
  /* eslint-enable react-hooks/set-state-in-effect */

  const hasPatient = patientId.length > 0

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    try {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: patientId || undefined,
          contactName: hasPatient ? undefined : contactName,
          contactPhone: hasPatient ? undefined : contactPhone,
          initialMessage,
          status,
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.error?.message ?? "Não foi possível criar a conversa.")
        return
      }
      toast.success("Conversa de teste criada.")
      onOpenChange(false)
      if (data?.data?.id) {
        router.push(`/conversas?c=${data.data.id}`)
      } else {
        router.refresh()
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
          <DialogTitle>Nova conversa de teste</DialogTitle>
          <DialogDescription>
            Crie uma conversa interna para testar o painel antes da integração com WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="conv-patient">Paciente (opcional)</Label>
            <select
              id="conv-patient"
              className={fieldClass}
              value={patientId}
              disabled={loading}
              onChange={(e) => setPatientId(e.target.value)}
            >
              <option value="">Sem paciente vinculado</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {!hasPatient && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="conv-name">Nome do contato</Label>
                <Input
                  id="conv-name"
                  value={contactName}
                  disabled={loading}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Ex.: Maria Silva"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="conv-phone">Telefone</Label>
                <Input
                  id="conv-phone"
                  value={contactPhone}
                  disabled={loading}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="Ex.: 11999990000"
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="conv-status">Status inicial</Label>
            <select
              id="conv-status"
              className={fieldClass}
              value={status}
              disabled={loading}
              onChange={(e) => setStatus(e.target.value)}
            >
              {conversationStatusValues
                .filter((value) => value !== "CLOSED")
                .map((value) => (
                  <option key={value} value={value}>{conversationStatusLabels[value]}</option>
                ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="conv-message">Mensagem inicial do paciente</Label>
            <Textarea
              id="conv-message"
              value={initialMessage}
              disabled={loading}
              rows={3}
              maxLength={2000}
              onChange={(e) => setInitialMessage(e.target.value)}
              placeholder="Ex.: Olá, gostaria de marcar uma avaliação."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              Criar conversa
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
