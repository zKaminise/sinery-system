"use client"

import * as React from "react"
import { Plus, MessagesSquare } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ConversationFilters, type ConversationFilterValues } from "@/components/conversations/conversation-filters"
import { ConversationList } from "@/components/conversations/conversation-list"
import { ConversationThread } from "@/components/conversations/conversation-thread"
import { ConversationDetailsPanel } from "@/components/conversations/conversation-details-panel"
import { NewConversationDialog } from "@/components/conversations/new-conversation-dialog"
import type {
  ConversationListItem,
  ConversationDetail,
  ConversationFormOptions,
} from "@/lib/conversations/queries"

interface ConversationsPageClientProps {
  items: ConversationListItem[]
  selected: ConversationDetail | null
  filters: ConversationFilterValues
  page: number
  totalPages: number
  timeZone: string
  formOptions: ConversationFormOptions
  canManage: boolean
  canAssignOthers: boolean
}

export function ConversationsPageClient({
  items,
  selected,
  filters,
  page,
  totalPages,
  timeZone,
  formOptions,
  canManage,
  canAssignOthers,
}: ConversationsPageClientProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false)

  // All hrefs preserve the active filters so navigating list <-> thread never
  // drops the current search/filter context.
  const baseParams = React.useCallback(() => {
    const params = new URLSearchParams()
    if (filters.q) params.set("q", filters.q)
    if (filters.status) params.set("status", filters.status)
    if (filters.channel) params.set("channel", filters.channel)
    if (filters.assignedUserId) params.set("assignedUserId", filters.assignedUserId)
    return params
  }, [filters])

  const buildItemHref = React.useCallback(
    (id: string) => {
      const params = baseParams()
      params.set("c", id)
      return `/conversas?${params.toString()}`
    },
    [baseParams]
  )

  const buildPageHref = React.useCallback(
    (targetPage: number) => {
      const params = baseParams()
      if (targetPage > 1) params.set("page", String(targetPage))
      if (selected) params.set("c", selected.id)
      return `/conversas?${params.toString()}`
    },
    [baseParams, selected]
  )

  const backHref = React.useMemo(() => {
    const params = baseParams()
    const qs = params.toString()
    return qs ? `/conversas?${qs}` : "/conversas"
  }, [baseParams])

  return (
    <div className="flex flex-col gap-4">
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" /> Nova conversa de teste
          </Button>
        </div>
      )}

      <div className="grid h-[calc(100vh-16rem)] min-h-[520px] grid-cols-1 overflow-hidden rounded-xl border border-border bg-card lg:grid-cols-[minmax(300px,340px)_1fr] xl:grid-cols-[minmax(320px,360px)_1fr_minmax(260px,300px)]">
        {/* List column: hidden on mobile when a conversation is open. */}
        <div
          className={cn(
            "flex min-h-0 flex-col border-r border-border",
            selected ? "hidden lg:flex" : "flex"
          )}
        >
          <div className="border-b border-border p-3">
            <ConversationFilters
              defaults={filters}
              users={formOptions.assignableUsers}
              selectedId={selected?.id}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ConversationList
              items={items}
              selectedId={selected?.id}
              timeZone={timeZone}
              page={page}
              totalPages={totalPages}
              buildItemHref={buildItemHref}
              buildPageHref={buildPageHref}
            />
          </div>
        </div>

        {/* Thread column. */}
        <div className={cn("min-h-0 flex-col", selected ? "flex" : "hidden lg:flex")}>
          {selected ? (
            <ConversationThread
              conversation={selected}
              timeZone={timeZone}
              canManage={canManage}
              canAssignOthers={canAssignOthers}
              assignableUsers={formOptions.assignableUsers}
              backHref={backHref}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <MessagesSquare className="size-6" />
              </div>
              <p className="text-sm font-medium text-foreground">Selecione uma conversa</p>
              <p className="max-w-xs text-sm text-muted-foreground">
                Escolha uma conversa na lista para ver as mensagens e atender o paciente.
              </p>
            </div>
          )}
        </div>

        {/* Details panel: only on xl and when a conversation is open. */}
        {selected && (
          <div className="hidden min-h-0 overflow-y-auto border-l border-border xl:block">
            <ConversationDetailsPanel conversation={selected} timeZone={timeZone} />
          </div>
        )}
      </div>

      {canManage && (
        <NewConversationDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          patients={formOptions.patients}
        />
      )}
    </div>
  )
}
