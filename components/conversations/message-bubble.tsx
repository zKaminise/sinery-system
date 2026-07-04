"use client"

import { Sparkles, Clock, Check, CheckCheck, CircleX, FlaskConical, EyeOff, Bot } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatInboxDateTime } from "@/components/conversations/format"
import { messageSenderLabels } from "@/lib/conversations/constants"
import type { ConversationMessageItem } from "@/lib/conversations/queries"

interface MessageBubbleProps {
  message: ConversationMessageItem
  timeZone: string
}

const DELIVERY: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; className: string }> = {
  PENDING: { label: "Enviando...", icon: Clock, className: "text-muted-foreground" },
  SENT: { label: "Enviada", icon: Check, className: "text-muted-foreground" },
  DELIVERED: { label: "Entregue", icon: CheckCheck, className: "text-muted-foreground" },
  READ: { label: "Lida", icon: CheckCheck, className: "text-secondary" },
  FAILED: { label: "Falhou", icon: CircleX, className: "text-destructive" },
  MOCK_SENT: { label: "Mock — não enviado à Meta", icon: FlaskConical, className: "text-warning" },
  INTERNAL_ONLY: { label: "Gerada internamente — não enviada ao WhatsApp", icon: EyeOff, className: "text-warning" },
}

const ASSIST_RUN: Record<string, { label: string; className: string }> = {
  SENT: { label: "Processada pela Sinery Assist", className: "text-success" },
  INTERNAL_ONLY: { label: "Processada (resposta interna)", className: "text-warning" },
  TRANSFERRED_TO_HUMAN: { label: "Processada — transferida para humano", className: "text-warning" },
  FAILED: { label: "Falhou ao processar", className: "text-destructive" },
  SKIPPED: { label: "Ignorada", className: "text-muted-foreground" },
  RUNNING: { label: "Processando...", className: "text-muted-foreground" },
}

function AssistRunBadge({ status }: { status: string }) {
  const cfg = ASSIST_RUN[status]
  if (!cfg) return null
  return (
    <span className={`flex items-center gap-1 px-1 text-[11px] ${cfg.className}`}>
      <Bot className="size-3" /> {cfg.label}
    </span>
  )
}

function DeliveryStatus({ status }: { status: string }) {
  const cfg = DELIVERY[status]
  if (!cfg) return null
  const Icon = cfg.icon
  return (
    <span className={cn("flex items-center gap-1 text-[11px]", cfg.className)}>
      <Icon className="size-3" /> {cfg.label}
    </span>
  )
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
      <div className="flex items-center gap-2 px-1">
        <span className="text-[11px] text-muted-foreground">
          {formatInboxDateTime(message.createdAt, timeZone)}
        </span>
        {!isInbound && message.deliveryStatus && <DeliveryStatus status={message.deliveryStatus} />}
        {isInbound && message.assistRunStatus && <AssistRunBadge status={message.assistRunStatus} />}
      </div>
    </div>
  )
}
