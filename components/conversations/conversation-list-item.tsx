"use client"

import Link from "next/link"
import { UserRound, Phone } from "lucide-react"

import { cn } from "@/lib/utils"
import { ConversationStatusBadge } from "@/components/conversations/conversation-status-badge"
import { formatInboxTimestamp } from "@/components/conversations/format"
import type { ConversationListItem as ConversationListItemData } from "@/lib/conversations/queries"

interface ConversationListItemProps {
  conversation: ConversationListItemData
  href: string
  selected: boolean
  timeZone: string
}

export function ConversationListItem({
  conversation,
  href,
  selected,
  timeZone,
}: ConversationListItemProps) {
  const pending = conversation.status === "WAITING_HUMAN"

  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col gap-1 border-l-2 px-3 py-2.5 transition-colors",
        selected
          ? "border-l-primary bg-muted"
          : "border-l-transparent hover:bg-muted/50"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {pending && <span className="size-2 shrink-0 rounded-full bg-warning" aria-hidden />}
          <span className="truncate text-sm font-medium text-foreground">
            {conversation.displayName}
          </span>
        </div>
        {conversation.lastMessageAt && (
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatInboxTimestamp(conversation.lastMessageAt, timeZone)}
          </span>
        )}
      </div>

      {conversation.lastMessagePreview && (
        <p className="truncate text-xs text-muted-foreground">
          {conversation.lastMessagePreview}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <ConversationStatusBadge status={conversation.status} />
        <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
          {conversation.assignedUserName ? (
            <>
              <UserRound className="size-3" />
              {conversation.assignedUserName}
            </>
          ) : conversation.phone ? (
            <>
              <Phone className="size-3" />
              {conversation.phone}
            </>
          ) : null}
        </span>
      </div>
    </Link>
  )
}
