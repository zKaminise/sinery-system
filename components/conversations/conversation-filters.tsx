"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Search, X } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  conversationStatusLabels,
  conversationChannelLabels,
} from "@/lib/conversations/constants"
import { conversationStatusValues, conversationChannelValues } from "@/lib/validators/conversation"

export interface ConversationFilterValues {
  q: string
  status: string
  channel: string
  assignedUserId: string
}

interface ConversationFiltersProps {
  defaults: ConversationFilterValues
  users: { id: string; name: string }[]
  selectedId?: string
}

const selectClass =
  "h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

export function ConversationFilters({ defaults, users, selectedId }: ConversationFiltersProps) {
  const router = useRouter()
  const [q, setQ] = React.useState(defaults.q)

  function apply(next: Partial<ConversationFilterValues>) {
    const merged = { ...defaults, q, ...next }
    const params = new URLSearchParams()
    if (merged.q) params.set("q", merged.q)
    if (merged.status) params.set("status", merged.status)
    if (merged.channel) params.set("channel", merged.channel)
    if (merged.assignedUserId) params.set("assignedUserId", merged.assignedUserId)
    if (selectedId) params.set("c", selectedId)
    router.push(`/conversas?${params.toString()}`)
  }

  const hasFilters = Boolean(defaults.q || defaults.status || defaults.channel || defaults.assignedUserId)

  return (
    <div className="flex flex-col gap-2">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          apply({ q })
        }}
        className="relative"
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Buscar contato, telefone ou mensagem..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9"
          aria-label="Buscar conversas"
        />
      </form>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <select
          aria-label="Filtrar por status"
          className={selectClass}
          value={defaults.status}
          onChange={(e) => apply({ status: e.target.value })}
        >
          <option value="">Todos os status</option>
          {conversationStatusValues.map((value) => (
            <option key={value} value={value}>{conversationStatusLabels[value]}</option>
          ))}
        </select>

        <select
          aria-label="Filtrar por canal"
          className={selectClass}
          value={defaults.channel}
          onChange={(e) => apply({ channel: e.target.value })}
        >
          <option value="">Todos os canais</option>
          {conversationChannelValues.map((value) => (
            <option key={value} value={value}>{conversationChannelLabels[value]}</option>
          ))}
        </select>

        <select
          aria-label="Filtrar por responsável"
          className={selectClass}
          value={defaults.assignedUserId}
          onChange={(e) => apply({ assignedUserId: e.target.value })}
        >
          <option value="">Todos os responsáveis</option>
          <option value="none">Sem responsável</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </div>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className={cn("w-fit")}
          onClick={() => {
            setQ("")
            apply({ q: "", status: "", channel: "", assignedUserId: "" })
          }}
        >
          <X className="size-4" /> Limpar filtros
        </Button>
      )}
    </div>
  )
}
