"use client"

import { Sparkles } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatInboxDateTime } from "@/components/conversations/format"
import type { AssistSimulationMessage } from "@/lib/assist/queries"

interface AssistMessageBubbleProps {
  message: AssistSimulationMessage
  timeZone: string
}

export function AssistMessageBubble({ message, timeZone }: AssistMessageBubbleProps) {
  const { senderType } = message

  if (senderType === "SYSTEM") {
    return (
      <div className="flex justify-center">
        <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
          {message.content}
        </span>
      </div>
    )
  }

  const isPatient = senderType === "PATIENT"
  const isAI = senderType === "AI"

  return (
    <div className={cn("flex flex-col gap-1", isPatient ? "items-start" : "items-end")}>
      <div className="flex items-center gap-1.5 px-1">
        {isAI && <Sparkles className="size-3 text-secondary" />}
        <span className={cn("text-xs font-medium", isAI ? "text-secondary" : "text-muted-foreground")}>
          {isPatient ? "Paciente (simulado)" : "Sinery Assist"}
        </span>
      </div>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap sm:max-w-[80%]",
          isPatient
            ? "rounded-tl-sm bg-muted text-foreground"
            : "rounded-tr-sm bg-secondary/10 text-foreground ring-1 ring-secondary/20"
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
