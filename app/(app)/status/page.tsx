"use client"

import * as React from "react"
import { Loader2, RefreshCw, Server, Database, Layers, Clock } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  SystemStatusCard,
  type StatusLevel,
} from "@/components/status/system-status-card"

interface DeepHealth {
  status: string
  database: string
  clinicsCount?: number
  responseTimeMs?: number
  version?: string
  environment?: string
  timestamp?: string
}

export default function StatusPage() {
  const [data, setData] = React.useState<DeepHealth | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [failed, setFailed] = React.useState(false)
  const [lastChecked, setLastChecked] = React.useState<Date | null>(null)

  const fetchStatus = React.useCallback(async () => {
    setLoading(true)
    setFailed(false)
    try {
      const response = await fetch("/api/health/deep", { cache: "no-store" })
      const json = (await response.json()) as DeepHealth
      setData(json)
    } catch {
      setFailed(true)
      setData(null)
    } finally {
      setLastChecked(new Date())
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    // Fetch once on mount. The synchronous setState inside fetchStatus is the
    // intended "load on mount" pattern, not a render-loop.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStatus()
  }, [fetchStatus])

  const appStatus: StatusLevel = failed ? "error" : loading && !data ? "unknown" : "ok"
  const dbStatus: StatusLevel = failed
    ? "error"
    : !data
      ? "unknown"
      : data.database === "ok"
        ? "ok"
        : "error"

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Status do sistema</h2>
          <p className="text-sm text-muted-foreground">
            Saúde da aplicação e do banco de dados em tempo real.
          </p>
        </div>
        <Button variant="outline" onClick={fetchStatus} disabled={loading}>
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          Atualizar status
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SystemStatusCard
          label="Aplicação"
          status={appStatus}
          value="Sinery System"
          icon={Server}
        />
        <SystemStatusCard
          label="Banco de dados"
          status={dbStatus}
          value={dbStatus === "ok" ? "Conectado" : dbStatus === "error" ? "Indisponível" : undefined}
          icon={Database}
        />
        <SystemStatusCard
          label="Clínicas cadastradas"
          status={dbStatus === "ok" ? "ok" : "unknown"}
          value={data?.clinicsCount != null ? String(data.clinicsCount) : "—"}
          icon={Layers}
        />
        <SystemStatusCard
          label="Tempo de resposta"
          status={dbStatus === "ok" ? "ok" : "unknown"}
          value={data?.responseTimeMs != null ? `${data.responseTimeMs} ms` : "—"}
          icon={Clock}
        />
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
        <span>
          Ambiente: <span className="font-medium text-foreground">{data?.environment ?? "—"}</span>
        </span>
        <span>
          Versão: <span className="font-medium text-foreground">{data?.version ?? "—"}</span>
        </span>
        <span>
          Última verificação:{" "}
          <span className="font-medium text-foreground">
            {lastChecked ? lastChecked.toLocaleTimeString("pt-BR") : "—"}
          </span>
        </span>
      </div>
    </div>
  )
}
