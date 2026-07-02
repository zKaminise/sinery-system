"use client"

import Link from "next/link"
import { ArrowLeft, Phone } from "lucide-react"

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

      {/* Composer (only for managers; read-only roles never see it) */}
      {canManage && (
        <MessageComposer conversationId={conversation.id} status={conversation.status} />
      )}
    </div>
  )
}
