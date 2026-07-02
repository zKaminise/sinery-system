"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Search, X } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { professionalStatusLabels } from "@/components/professionals/professional-status-badge"

interface ProfessionalsFiltersProps {
  defaults: { q: string; status: string }
}

const selectClass =
  "h-8 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

export function ProfessionalsFilters({ defaults }: ProfessionalsFiltersProps) {
  const router = useRouter()
  const [q, setQ] = React.useState(defaults.q)

  function applyFilters(next: Partial<{ q: string; status: string }>) {
    const merged = { q: next.q ?? q, status: next.status ?? defaults.status }
    const params = new URLSearchParams()
    if (merged.q) params.set("q", merged.q)
    if (merged.status) params.set("status", merged.status)
    router.push(`/profissionais${params.toString() ? `?${params.toString()}` : ""}`)
  }

  function clearAll() {
    setQ("")
    router.push("/profissionais")
  }

  const hasFilters = Boolean(defaults.q || defaults.status)

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
          placeholder="Buscar por nome, telefone, e-mail ou especialidade..."
          value={q}
          onChange={(event) => setQ(event.target.value)}
          className="pl-9"
          aria-label="Buscar profissionais"
        />
      </form>

      <select
        aria-label="Filtrar por status"
        className={selectClass}
        value={defaults.status}
        onChange={(event) => applyFilters({ status: event.target.value })}
      >
        <option value="">Todos os status</option>
        {Object.entries(professionalStatusLabels).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
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
