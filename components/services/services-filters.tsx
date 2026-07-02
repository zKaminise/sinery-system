"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Search, X } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { serviceStatusLabels } from "@/components/services/service-status-badge"
import { suggestedDurations } from "@/lib/validators/service"

interface ServicesFiltersProps {
  defaults: { q: string; status: string; duration: string }
}

const selectClass =
  "h-8 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

export function ServicesFilters({ defaults }: ServicesFiltersProps) {
  const router = useRouter()
  const [q, setQ] = React.useState(defaults.q)

  function applyFilters(next: Partial<{ q: string; status: string; duration: string }>) {
    const merged = {
      q: next.q ?? q,
      status: next.status ?? defaults.status,
      duration: next.duration ?? defaults.duration,
    }
    const params = new URLSearchParams()
    if (merged.q) params.set("q", merged.q)
    if (merged.status) params.set("status", merged.status)
    if (merged.duration) params.set("duration", merged.duration)
    router.push(`/servicos${params.toString() ? `?${params.toString()}` : ""}`)
  }

  function clearAll() {
    setQ("")
    router.push("/servicos")
  }

  const hasFilters = Boolean(defaults.q || defaults.status || defaults.duration)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          applyFilters({ q })
        }}
        className="relative flex-1 min-w-[220px]"
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Buscar por nome ou descrição..."
          value={q}
          onChange={(event) => setQ(event.target.value)}
          className="pl-9"
          aria-label="Buscar serviços"
        />
      </form>

      <select
        aria-label="Filtrar por status"
        className={selectClass}
        value={defaults.status}
        onChange={(event) => applyFilters({ status: event.target.value })}
      >
        <option value="">Todos os status</option>
        {Object.entries(serviceStatusLabels).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>

      <select
        aria-label="Filtrar por duração"
        className={selectClass}
        value={defaults.duration}
        onChange={(event) => applyFilters({ duration: event.target.value })}
      >
        <option value="">Todas as durações</option>
        {suggestedDurations.map((d) => (
          <option key={d} value={d}>{d} min</option>
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
