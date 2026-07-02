"use client"

import { Sparkles } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatInboxDateTime } from "@/components/conversations/format"
import { messageSenderLabels } from "@/lib/conversations/constants"
import type { ConversationMessageItem } from "@/lib/conversations/queries"

interface MessageBubbleProps {
  message: ConversationMessageItem
  timeZone: string
}

export function MessageBubble({ message, timeZone }: MessageBubbleProps) {
  const { senderType } = message

  // System messages are centered, neutral separators.
  if (senderType === "SYSTEM") {
    return (
      <div className="flex justify-center">
        <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
          {message.content}
        </span>
      </div>
    )
  }

  // Patient (inbound) aligns left; human/AI (outbound) align right.
  const isInbound = senderType === "PATIENT"
  const isAI = senderType === "AI"

  const senderLabel =
    senderType === "HUMAN"
      ? message.senderName ?? messageSenderLabels.HUMAN
      : messageSenderLabels[senderType]

  return (
    <div className={cn("flex flex-col gap-1", isInbound ? "items-start" : "items-end")}>
      <div className="flex items-center gap-1.5 px-1">
        {isAI && <Sparkles className="size-3 text-secondary" />}
        <span className={cn("text-xs font-medium", isAI ? "text-secondary" : "text-muted-foreground")}>
          {senderLabel}
        </span>
      </div>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap sm:max-w-[75%]",
          isInbound && "rounded-tl-sm bg-muted text-foreground",
          isAI && "rounded-tr-sm bg-secondary/10 text-foreground ring-1 ring-secondary/20",
          senderType === "HUMAN" && "rounded-tr-sm bg-primary text-primary-foreground"
        )}
      >
        {message.content}
      </div>
      <span className="px-1 text-[11px] text-muted-foreground">
        {formatInboxDateTime(message.createdAt, timeZone)}
      </span>
    </div>
  )
}
