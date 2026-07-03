"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, SendHorizonal, Loader2, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ConversationStatusBadge } from "@/components/conversations/conversation-status-badge"
import { AssistMessageBubble } from "@/components/assist/assist-message-bubble"
import type { AssistSimulationDetail } from "@/lib/assist/queries"

interface AssistChatProps {
  simulation: AssistSimulationDetail
  timeZone: string
  canUse: boolean
  backHref: string
}

export function AssistChat({ simulation, timeZone, canUse, backHref }: AssistChatProps) {
  const router = useRouter()
  const [content, setContent] = React.useState("")
  const [sending, setSending] = React.useState(false)

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setSending(true)
    try {
      const response = await fetch(`/api/assist/simulations/${simulation.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.error?.message ?? "Não foi possível processar a mensagem.")
        return
      }
      setContent("")
      router.refresh()
    } catch {
      toast.error("Erro de conexão. Tente novamente.")
    } finally {
      setSending(false)
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void sendMessage(content)
  }

  // Slot-selection quick buttons: sending "N" keeps the exact same flow as
  // typing the number, so the deterministic state machine handles it.
  const showSlotButtons =
    canUse && simulation.assist.step === "WAITING_SLOT_SELECTION" && simulation.assist.suggestedSlots.length > 0

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <Button
          variant="ghost"
          size="icon-sm"
          className="lg:hidden"
          aria-label="Voltar"
          nativeButton={false}
          render={<Link href={backHref}><ArrowLeft className="size-4" /></Link>}
        />
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary/15 text-secondary">
          <Sparkles className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{simulation.displayName}</p>
          <p className="truncate text-xs text-muted-foreground">Simulação da Sinery Assist</p>
        </div>
        <ConversationStatusBadge status={simulation.status} />
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {simulation.messages.map((message) => (
          <AssistMessageBubble key={message.id} message={message} timeZone={timeZone} />
        ))}
      </div>

      {showSlotButtons && (
        <div className="flex flex-wrap gap-2 border-t border-border px-3 py-2.5">
          {simulation.assist.suggestedSlots.map((slot) => (
            <Button
              key={slot.option}
              variant="outline"
              size="sm"
              disabled={sending}
              onClick={() => sendMessage(String(slot.option))}
            >
              Escolher opção {slot.option} · {slot.displayTime} · {slot.professionalName}
            </Button>
          ))}
        </div>
      )}

      {canUse ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-1.5 border-t border-border p-3">
          <span className="text-[11px] text-muted-foreground">Digite como se fosse o paciente:</span>
          <div className="flex items-end gap-2">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Ex.: Quero marcar uma limpeza amanhã"
              rows={1}
              maxLength={2000}
              disabled={sending}
              className="min-h-9 flex-1 resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  e.currentTarget.form?.requestSubmit()
                }
              }}
            />
            <Button type="submit" size="icon-lg" disabled={sending || content.trim().length === 0} aria-label="Enviar">
              {sending ? <Loader2 className="size-4 animate-spin" /> : <SendHorizonal className="size-4" />}
            </Button>
          </div>
        </form>
      ) : (
        <div className="border-t border-border bg-muted/40 px-4 py-3 text-center text-sm text-muted-foreground">
          Você tem acesso somente leitura ao simulador.
        </div>
      )}
    </div>
  )
}
