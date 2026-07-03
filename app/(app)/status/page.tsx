"use client"

import * as React from "react"
import { Loader2, RefreshCw, Server, Database, Layers, Clock, Sparkles, KeyRound, Cpu, ShieldAlert, MessageCircle, Webhook } from "lucide-react"

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
  ai?: {
    effectiveMode: "OPENAI" | "RULE_BASED" | "DISABLED"
    hasApiKey: boolean
    isMock: boolean
    globalDisabled: boolean
    model: string | null
    useRealAiFlag: boolean
  }
  whatsapp?: {
    enabled: boolean
    effectiveStatus: string
    hasAccessToken: boolean
    hasPhoneNumberId: boolean
    hasAppSecret: boolean
    hasWebhookVerifyToken: boolean
    sendMessagesEnabled: boolean
    webhookEnabled: boolean
    verifySignature: boolean
    webhookPath: string
    graphApiVersion: string
  }
  version?: string
  environment?: string
  timestamp?: string
}

const AI_MODE_LABEL: Record<string, string> = {
  OPENAI: "IA real",
  RULE_BASED: "Simulador",
  DISABLED: "Desativada",
}

const WA_STATUS_LABEL: Record<string, string> = {
  NOT_CONFIGURED: "Não configurado",
  CONFIGURED: "Configurado",
  INVALID_CONFIG: "Configuração inválida",
  DISABLED: "Desativado",
  READY_FOR_WEBHOOK: "Pronto p/ webhook",
  READY_FOR_SEND: "Pronto p/ envio",
  ERROR: "Erro",
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

      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Sinery Assist (IA)</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SystemStatusCard
            label="Modo efetivo"
            status={data?.ai?.effectiveMode === "DISABLED" ? "warning" : dbStatus === "ok" ? "ok" : "unknown"}
            value={data?.ai ? AI_MODE_LABEL[data.ai.effectiveMode] + (data.ai.isMock ? " (mock)" : "") : "—"}
            icon={Sparkles}
          />
          <SystemStatusCard
            label="Chave da OpenAI"
            status={data?.ai ? (data.ai.hasApiKey ? "ok" : "warning") : "unknown"}
            value={data?.ai ? (data.ai.hasApiKey ? "Configurada" : "Não configurada") : "—"}
            icon={KeyRound}
          />
          <SystemStatusCard
            label="Modelo"
            status={dbStatus === "ok" ? "ok" : "unknown"}
            value={data?.ai?.model ?? "—"}
            icon={Cpu}
          />
          <SystemStatusCard
            label="Kill switch global"
            status={data?.ai?.globalDisabled ? "warning" : "ok"}
            value={data?.ai ? (data.ai.globalDisabled ? "Ativado (bloqueado)" : "Desligado") : "—"}
            icon={ShieldAlert}
          />
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">WhatsApp Cloud API</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SystemStatusCard
            label="Status da integração"
            status={
              !data?.whatsapp
                ? "unknown"
                : data.whatsapp.effectiveStatus === "INVALID_CONFIG" || data.whatsapp.effectiveStatus === "ERROR"
                  ? "error"
                  : data.whatsapp.effectiveStatus === "NOT_CONFIGURED" || data.whatsapp.effectiveStatus === "DISABLED"
                    ? "warning"
                    : "ok"
            }
            value={data?.whatsapp ? WA_STATUS_LABEL[data.whatsapp.effectiveStatus] ?? data.whatsapp.effectiveStatus : "—"}
            icon={MessageCircle}
          />
          <SystemStatusCard
            label="Access token (env)"
            status={data?.whatsapp ? (data.whatsapp.hasAccessToken ? "ok" : "warning") : "unknown"}
            value={data?.whatsapp ? (data.whatsapp.hasAccessToken ? "Configurado" : "Não configurado") : "—"}
            icon={KeyRound}
          />
          <SystemStatusCard
            label="Recebimento (webhook)"
            status={data?.whatsapp?.webhookEnabled ? "ok" : "warning"}
            value={data?.whatsapp ? (data.whatsapp.webhookEnabled ? "Habilitado" : "Desativado") : "—"}
            icon={Webhook}
          />
          <SystemStatusCard
            label="Validação de assinatura"
            status={data?.whatsapp ? (data.whatsapp.verifySignature ? "ok" : "warning") : "unknown"}
            value={data?.whatsapp ? (data.whatsapp.verifySignature ? "Ativa" : "Desativada (dev)") : "—"}
            icon={ShieldAlert}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Caminho do webhook: <code className="text-foreground">{data?.whatsapp?.webhookPath ?? "—"}</code> · Envio real:{" "}
          {data?.whatsapp?.sendMessagesEnabled ? "habilitado" : "desativado (próximo prompt)"}
        </p>
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
