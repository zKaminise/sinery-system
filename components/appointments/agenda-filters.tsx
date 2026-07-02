"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Search, X, CalendarDays, Columns3, List } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { appointmentStatusLabels } from "@/components/appointments/appointment-status-badge"

export type AgendaView = "day" | "week" | "list"

interface AgendaFiltersProps {
  defaults: {
    view: AgendaView
    date: string
    professionalId: string
    status: string
    q: string
  }
  professionals: { id: string; name: string }[]
}

const selectClass =
  "h-8 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

export function AgendaFilters({ defaults, professionals }: AgendaFiltersProps) {
  const router = useRouter()
  const [q, setQ] = React.useState(defaults.q)

  function apply(next: Partial<AgendaFiltersProps["defaults"]>) {
    const merged = { ...defaults, q, ...next }
    const params = new URLSearchParams()
    params.set("view", merged.view)
    if (merged.date) params.set("date", merged.date)
    if (merged.professionalId) params.set("professionalId", merged.professionalId)
    if (merged.status) params.set("status", merged.status)
    if (merged.q) params.set("q", merged.q)
    router.push(`/agenda?${params.toString()}`)
  }

  const views: { value: AgendaView; label: string; icon: typeof CalendarDays }[] = [
    { value: "day", label: "Dia", icon: CalendarDays },
    { value: "week", label: "Semana", icon: Columns3 },
    { value: "list", label: "Lista", icon: List },
  ]

  const hasExtraFilters = Boolean(defaults.professionalId || defaults.status || defaults.q)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-border p-0.5">
          {views.map((v) => {
            const active = defaults.view === v.value
            return (
              <button
                key={v.value}
                type="button"
                onClick={() => apply({ view: v.value })}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <v.icon className="size-4" />
                {v.label}
              </button>
            )
          })}
        </div>

        <input
          type="date"
          aria-label="Data"
          className={cn(selectClass, "h-8")}
          value={defaults.date}
          onChange={(e) => apply({ date: e.target.value })}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            apply({ q })
          }}
          className="relative flex-1 min-w-[220px]"
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar por paciente, profissional ou serviço..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
            aria-label="Buscar consultas"
          />
        </form>

        <select
          aria-label="Filtrar por profissional"
          className={selectClass}
          value={defaults.professionalId}
          onChange={(e) => apply({ professionalId: e.target.value })}
        >
          <option value="">Todos os profissionais</option>
          {professionals.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <select
          aria-label="Filtrar por status"
          className={selectClass}
          value={defaults.status}
          onChange={(e) => apply({ status: e.target.value })}
        >
          <option value="">Todos os status</option>
          {Object.entries(appointmentStatusLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        {hasExtraFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQ("")
              apply({ professionalId: "", status: "", q: "" })
            }}
          >
            <X className="size-4" />
            Limpar
          </Button>
        )}
      </div>
    </div>
  )
}
