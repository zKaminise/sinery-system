"use client"

import Link from "next/link"
import { ArrowLeft, Phone, MessageCircle, Info } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ConversationStatusBadge } from "@/components/conversations/conversation-status-badge"
import { ConversationActions } from "@/components/conversations/conversation-actions"
import { MessageBubble } from "@/components/conversations/message-bubble"
import { MessageComposer } from "@/components/conversations/message-composer"
import { conversationChannelLabels } from "@/lib/conversations/constants"
import type { ConversationDetail } from "@/lib/conversations/queries"

interface ConversationThreadProps {
  conversation: ConversationDetail
  timeZone: string
  canManage: boolean
  canAssignOthers: boolean
  assignableUsers: { id: string; name: string }[]
  backHref: string
}

export function ConversationThread({
  conversation,
  timeZone,
  canManage,
  canAssignOthers,
  assignableUsers,
  backHref,
}: ConversationThreadProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <Button
          variant="ghost"
          size="icon-sm"
          className="lg:hidden"
          aria-label="Voltar para a lista"
          nativeButton={false}
          render={<Link href={backHref}><ArrowLeft className="size-4" /></Link>}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">{conversation.displayName}</p>
            <ConversationStatusBadge status={conversation.status} />
            {conversation.channel === "WHATSAPP" && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                <MessageCircle className="size-3" /> WhatsApp
              </span>
            )}
          </div>
          <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            <Phone className="size-3" />
            {conversation.phone ?? "Sem telefone"} · {conversationChannelLabels[conversation.channel]}
            {conversation.assignedUserName ? ` · ${conversation.assignedUserName}` : ""}
          </p>
        </div>
        {canManage && (
          <ConversationActions
            conversationId={conversation.id}
            status={conversation.status}
            canAssignOthers={canAssignOthers}
            users={assignableUsers}
          />
        )}
      </div>

      {/* Messages */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {conversation.messages.map((message) => (
          <MessageBubble key={message.id} message={message} timeZone={timeZone} />
        ))}
      </div>

      {/* Composer. WHATSAPP has real send with gated states; INTERNAL_SIMULATOR
          keeps the normal composer. Read-only roles never see a composer. */}
      {canManage &&
        (conversation.channel === "WHATSAPP" ? (
          <WhatsAppComposerSlot conversation={conversation} />
        ) : (
          <MessageComposer conversationId={conversation.id} status={conversation.status} />
        ))}
    </div>
  )
}

function ComposerNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 border-t border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
      <Info className="mt-0.5 size-3.5 shrink-0 text-warning" />
      <span>{children}</span>
    </div>
  )
}

function WhatsAppComposerSlot({ conversation }: { conversation: ConversationDetail }) {
  if (conversation.status === "CLOSED") {
    return <ComposerNotice>Reabra a conversa para enviar uma nova mensagem.</ComposerNotice>
  }
  const wa = conversation.whatsApp
  if (!wa || !wa.sendEnabled) {
    return <ComposerNotice>Envio real pelo WhatsApp está desativado nas configurações.</ComposerNotice>
  }
  if (!wa.withinWindow) {
    return <ComposerNotice>Janela de 24 horas expirada. Templates serão implementados em etapa futura.</ComposerNotice>
  }
  return (
    <>
      {wa.mockMode && (
        <div className="border-t border-border bg-warning/5 px-4 py-1.5 text-center text-[11px] text-warning">
          Modo mock ativo — mensagens não são enviadas à Meta.
        </div>
      )}
      <MessageComposer conversationId={conversation.id} status={conversation.status} whatsapp />
    </>
  )
}
