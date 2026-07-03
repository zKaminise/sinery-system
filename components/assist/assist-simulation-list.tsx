"use client"

import Link from "next/link"
import { Sparkles } from "lucide-react"

import { cn } from "@/lib/utils"
import { ConversationStatusBadge } from "@/components/conversations/conversation-status-badge"
import { EmptyState } from "@/components/common/empty-state"
import { formatInboxTimestamp } from "@/components/conversations/format"
import type { AssistSimulationListItem } from "@/lib/assist/queries"

interface AssistSimulationListProps {
  items: AssistSimulationListItem[]
  selectedId?: string
  timeZone: string
  buildHref: (id: string) => string
}

export function AssistSimulationList({ items, selectedId, timeZone, buildHref }: AssistSimulationListProps) {
  if (items.length === 0) {
    return (
      <div className="p-4">
        <EmptyState
          icon={Sparkles}
          title="Nenhuma simulação ainda."
          description="Clique em “Nova simulação” para testar o atendimento da Sinery Assist."
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col divide-y divide-border">
      {items.map((item) => (
        <Link
          key={item.id}
          href={buildHref(item.id)}
          className={cn(
            "flex flex-col gap-1 border-l-2 px-3 py-2.5 transition-colors",
            item.id === selectedId ? "border-l-secondary bg-muted" : "border-l-transparent hover:bg-muted/50"
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium text-foreground">{item.displayName}</span>
            {item.lastMessageAt && (
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatInboxTimestamp(item.lastMessageAt, timeZone)}
              </span>
            )}
          </div>
          {item.lastMessagePreview && (
            <p className="truncate text-xs text-muted-foreground">{item.lastMessagePreview}</p>
          )}
          <ConversationStatusBadge status={item.status} />
        </Link>
      ))}
    </div>
  )
}
