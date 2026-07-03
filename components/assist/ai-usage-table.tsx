"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight, Filter, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { AiUsageLogsResult, AiUsageFilters } from "@/lib/ai/assist-usage-queries"

const inputClass =
  "h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-secondary/40"

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
}

function fmtCents(cents: number | null): string {
  if (cents == null) return "—"
  return `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
}

export function AiUsageTable({ result, filters }: { result: AiUsageLogsResult; filters: AiUsageFilters }) {
  const router = useRouter()

  const [form, setForm] = React.useState({
    dateFrom: filters.dateFrom ?? "",
    dateTo: filters.dateTo ?? "",
    provider: filters.provider ?? "",
    success: filters.success ?? "",
    conversationId: filters.conversationId ?? "",
    errorCode: filters.errorCode ?? "",
  })

  function pushQuery(next: Record<string, string | number | undefined>) {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(next)) {
      if (v !== undefined && v !== "") params.set(k, String(v))
    }
    router.push(`/assist/uso?${params.toString()}`)
  }

  function applyFilters(e: React.FormEvent) {
    e.preventDefault()
    pushQuery({ ...form, page: 1 })
  }

  function clearFilters() {
    setForm({ dateFrom: "", dateTo: "", provider: "", success: "", conversationId: "", errorCode: "" })
    router.push("/assist/uso")
  }

  function goToPage(page: number) {
    pushQuery({ ...form, page })
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={applyFilters} className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          De
          <input type="date" className={inputClass} value={form.dateFrom} onChange={(e) => setForm({ ...form, dateFrom: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Até
          <input type="date" className={inputClass} value={form.dateTo} onChange={(e) => setForm({ ...form, dateTo: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Provider
          <select className={inputClass} value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })}>
            <option value="">Todos</option>
            <option value="OPENAI">OPENAI</option>
            <option value="RULE_BASED">RULE_BASED</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Resultado
          <select className={inputClass} value={form.success} onChange={(e) => setForm({ ...form, success: e.target.value })}>
            <option value="">Todos</option>
            <option value="true">Sucesso</option>
            <option value="false">Erro</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Conversa
          <input className={inputClass} placeholder="conversationId" value={form.conversationId} onChange={(e) => setForm({ ...form, conversationId: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Erro
          <input className={inputClass} placeholder="errorCode" value={form.errorCode} onChange={(e) => setForm({ ...form, errorCode: e.target.value })} />
        </label>
        <Button type="submit" size="sm">
          <Filter className="size-4" /> Filtrar
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
          <X className="size-4" /> Limpar
        </Button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Data/hora</th>
              <th className="px-3 py-2 font-medium">Provider</th>
              <th className="px-3 py-2 font-medium">Modo</th>
              <th className="px-3 py-2 font-medium">Modelo</th>
              <th className="px-3 py-2 font-medium">Conversa</th>
              <th className="px-3 py-2 font-medium">Resultado</th>
              <th className="px-3 py-2 text-right font-medium">Tokens (in/out/total)</th>
              <th className="px-3 py-2 text-right font-medium">Custo est.</th>
              <th className="px-3 py-2 font-medium">Erro</th>
              <th className="px-3 py-2 text-right font-medium">Tempo</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">
                  Nenhum registro de uso encontrado com esses filtros.
                </td>
              </tr>
            ) : (
              result.rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="whitespace-nowrap px-3 py-2 text-foreground">{fmtDateTime(r.createdAt)}</td>
                  <td className="px-3 py-2">{r.provider}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.mode ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.model ?? "—"}</td>
                  <td className="max-w-[8rem] truncate px-3 py-2 text-muted-foreground" title={r.conversationId ?? ""}>
                    {r.conversationId ? r.conversationId.slice(0, 8) + "…" : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span className={r.success ? "text-success" : "text-destructive"}>{r.success ? "Sucesso" : "Erro"}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-muted-foreground">
                    {r.inputTokens ?? 0}/{r.outputTokens ?? 0}/{r.totalTokens ?? 0}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-foreground">{fmtCents(r.estimatedCostInCents)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.errorCode ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-muted-foreground">{r.latencyMs != null ? `${r.latencyMs} ms` : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {result.total} registro(s) · página {result.page} de {result.totalPages}
        </span>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" disabled={result.page <= 1} onClick={() => goToPage(result.page - 1)}>
            <ChevronLeft className="size-4" /> Anterior
          </Button>
          <Button variant="outline" size="sm" disabled={result.page >= result.totalPages} onClick={() => goToPage(result.page + 1)}>
            Próxima <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
