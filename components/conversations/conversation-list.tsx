"use client"

import Link from "next/link"
import { MessagesSquare } from "lucide-react"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/empty-state"
import { ConversationListItem } from "@/components/conversations/conversation-list-item"
import type { ConversationListItem as ConversationListItemData } from "@/lib/conversations/queries"

interface ConversationListProps {
  items: ConversationListItemData[]
  selectedId?: string
  timeZone: string
  page: number
  totalPages: number
  buildItemHref: (id: string) => string
  buildPageHref: (page: number) => string
}

export function ConversationList({
  items,
  selectedId,
  timeZone,
  page,
  totalPages,
  buildItemHref,
  buildPageHref,
}: ConversationListProps) {
  if (items.length === 0) {
    return (
      <div className="p-4">
        <EmptyState
          icon={MessagesSquare}
          title="Nenhuma conversa encontrada."
          description="Crie uma conversa de teste para validar o fluxo de atendimento."
        />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col divide-y divide-border overflow-y-auto">
        {items.map((item) => (
          <ConversationListItem
            key={item.id}
            conversation={item}
            href={buildItemHref(item.id)}
            selected={item.id === selectedId}
            timeZone={timeZone}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border px-3 py-2">
          <span className="text-xs text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              nativeButton={false}
              render={page <= 1 ? <span>Anterior</span> : <Link href={buildPageHref(page - 1)}>Anterior</Link>}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              nativeButton={false}
              render={page >= totalPages ? <span>Próxima</span> : <Link href={buildPageHref(page + 1)}>Próxima</Link>}
            />
          </div>
        </div>
      )}
    </div>
  )
}
