"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Search, X } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { patientSources } from "@/lib/validators/patient"
import { patientStatusLabels } from "@/components/patients/patient-status-badge"

interface PatientsFiltersProps {
  defaults: { q: string; status: string; source: string }
}

const selectClass =
  "h-8 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

export function PatientsFilters({ defaults }: PatientsFiltersProps) {
  const router = useRouter()
  const [q, setQ] = React.useState(defaults.q)

  function applyFilters(next: Partial<{ q: string; status: string; source: string }>) {
    const merged = {
      q: next.q ?? q,
      status: next.status ?? defaults.status,
      source: next.source ?? defaults.source,
    }
    const params = new URLSearchParams()
    if (merged.q) params.set("q", merged.q)
    if (merged.status) params.set("status", merged.status)
    if (merged.source) params.set("source", merged.source)
    // Any filter change resets pagination to the first page.
    router.push(`/pacientes${params.toString() ? `?${params.toString()}` : ""}`)
  }

  function clearAll() {
    setQ("")
    router.push("/pacientes")
  }

  const hasFilters = Boolean(defaults.q || defaults.status || defaults.source)

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
          placeholder="Buscar por nome, telefone, e-mail ou documento..."
          value={q}
          onChange={(event) => setQ(event.target.value)}
          className="pl-9"
          aria-label="Buscar pacientes"
        />
      </form>

      <select
        aria-label="Filtrar por status"
        className={selectClass}
        value={defaults.status}
        onChange={(event) => applyFilters({ status: event.target.value })}
      >
        <option value="">Todos os status</option>
        {Object.entries(patientStatusLabels).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>

      <select
        aria-label="Filtrar por origem"
        className={selectClass}
        value={defaults.source}
        onChange={(event) => applyFilters({ source: event.target.value })}
      >
        <option value="">Todas as origens</option>
        {patientSources.map((s) => (
          <option key={s} value={s}>{s}</option>
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
