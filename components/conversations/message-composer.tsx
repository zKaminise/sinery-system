"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { SendHorizonal, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { ConversationStatus } from "@/lib/generated/prisma/client"

interface MessageComposerProps {
  conversationId: string
  status: ConversationStatus
  /** WhatsApp variant changes the placeholder + button label. */
  whatsapp?: boolean
}

export function MessageComposer({ conversationId, status, whatsapp = false }: MessageComposerProps) {
  const router = useRouter()
  const [content, setContent] = React.useState("")
  const [sending, setSending] = React.useState(false)

  if (status === "CLOSED") {
    return (
      <div className="border-t border-border bg-muted/40 px-4 py-3 text-center text-sm text-muted-foreground">
        Reabra a conversa para enviar uma nova mensagem.
      </div>
    )
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = content.trim()
    if (!trimmed) return
    setSending(true)
    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.error?.message ?? "Não foi possível enviar a mensagem.")
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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1 border-t border-border p-3">
      {whatsapp && (
        <span className="px-1 text-[11px] text-success">Enviar pelo WhatsApp — responde ao paciente pelo número real.</span>
      )}
      <div className="flex items-end gap-2">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={whatsapp ? "Responder pelo WhatsApp..." : "Escreva uma mensagem..."}
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
        <Button type="submit" size="icon-lg" disabled={sending || content.trim().length === 0} aria-label="Enviar mensagem">
          {sending ? <Loader2 className="size-4 animate-spin" /> : <SendHorizonal className="size-4" />}
        </Button>
      </div>
    </form>
  )
}
