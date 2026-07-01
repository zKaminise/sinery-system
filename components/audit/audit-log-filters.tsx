"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Search, X } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { getAuditActionLabel } from "@/lib/audit-actions"

interface AuditLogFiltersProps {
  actions: string[]
  entities: string[]
  defaults: { q: string; action: string; entity: string }
}

const selectClass =
  "h-8 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

export function AuditLogFilters({ actions, entities, defaults }: AuditLogFiltersProps) {
  const router = useRouter()
  const [q, setQ] = React.useState(defaults.q)

  function applyFilters(next: Partial<{ q: string; action: string; entity: string }>) {
    const params = new URLSearchParams()
    const merged = {
      q: next.q ?? q,
      action: next.action ?? defaults.action,
      entity: next.entity ?? defaults.entity,
    }
    if (merged.q) params.set("q", merged.q)
    if (merged.action) params.set("action", merged.action)
    if (merged.entity) params.set("entity", merged.entity)
    // Any filter change resets pagination to the first page.
    router.push(`/auditoria${params.toString() ? `?${params.toString()}` : ""}`)
  }

  function clearAll() {
    setQ("")
    router.push("/auditoria")
  }

  const hasFilters = Boolean(defaults.q || defaults.action || defaults.entity)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          applyFilters({ q })
        }}
        className="relative flex-1 min-w-[200px]"
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Buscar na descrição..."
          value={q}
          onChange={(event) => setQ(event.target.value)}
          className="pl-9"
          aria-label="Buscar registros de auditoria"
        />
      </form>

      <select
        aria-label="Filtrar por ação"
        className={selectClass}
        value={defaults.action}
        onChange={(event) => applyFilters({ action: event.target.value })}
      >
        <option value="">Todas as ações</option>
        {actions.map((action) => (
          <option key={action} value={action}>
            {getAuditActionLabel(action)}
          </option>
        ))}
      </select>

      <select
        aria-label="Filtrar por entidade"
        className={selectClass}
        value={defaults.entity}
        onChange={(event) => applyFilters({ entity: event.target.value })}
      >
        <option value="">Todas as entidades</option>
        {entities.map((entity) => (
          <option key={entity} value={entity}>
            {entity}
          </option>
        ))}
      </select>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearAll}>
          <X className="size-4" />
          Limpar
        </Button>
      )}
    </div>
  )
}
