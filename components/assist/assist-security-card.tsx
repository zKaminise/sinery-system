import Link from "next/link"
import { ShieldCheck, ExternalLink, Gauge, KeyRound, Cpu, AlertTriangle } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { auditActionLabels } from "@/lib/audit-actions"
import type { AssistSecurityOverview, AssistBadge } from "@/lib/ai/assist-security-overview"

const BADGE_STYLE: Record<AssistBadge, { label: string; className: string }> = {
  OK: { label: "OK", className: "bg-success/10 text-success" },
  ATTENTION: { label: "Atenção", className: "bg-warning/10 text-warning" },
  NEAR_LIMIT: { label: "Limite próximo", className: "bg-warning/10 text-warning" },
  DISABLED: { label: "Desativada", className: "bg-destructive/10 text-destructive" },
  NO_API_KEY: { label: "Sem API key", className: "bg-warning/10 text-warning" },
  USING_SIMULATOR: { label: "Usando simulador", className: "bg-secondary/15 text-secondary" },
  USING_REAL_AI: { label: "Usando IA real", className: "bg-primary/10 text-primary" },
}

function fmtCents(cents: number): string {
  return `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
}

function Line({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  )
}

export function AssistSecurityCard({
  overview,
  canViewUsage,
}: {
  overview: AssistSecurityOverview
  canViewUsage: boolean
}) {
  const s = overview.summary
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="size-4.5 text-primary" /> Segurança e uso
        </CardTitle>
        {canViewUsage && (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/assist/uso"><ExternalLink className="size-4" /> Ver painel de uso</Link>}
          />
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-1.5">
          {overview.badges.map((b) => (
            <span key={b} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE_STYLE[b].className}`}>
              {BADGE_STYLE[b].label}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Line icon={Gauge} label="Modo efetivo" value={overview.effectiveMode === "OPENAI" ? "IA real" : overview.effectiveMode === "DISABLED" ? "Desativada" : "Simulador"} />
          <Line icon={KeyRound} label="Chave da OpenAI" value={overview.hasApiKey ? "Configurada" : "Não configurada"} />
          <Line icon={Cpu} label="Modelo" value={overview.model ?? "—"} />
          <Line icon={Gauge} label="Chamadas no último minuto" value={String(overview.callsLastMinute)} />
          <Line icon={Gauge} label="Tokens hoje" value={`${overview.tokensToday.toLocaleString("pt-BR")} / ${overview.dailyTokenLimit.toLocaleString("pt-BR")}`} />
          {canViewUsage && <Line icon={Gauge} label="Custo estimado hoje" value={fmtCents(s.estimatedCostTodayCents)} />}
          <Line icon={Gauge} label="Chamadas hoje" value={`${s.callsToday} (${s.errorToday} erro)`} />
          <Line icon={Gauge} label="Kill switch global" value={overview.globalDisabled ? "Ativado" : "Desligado"} />
        </div>

        {overview.recentSafetyEvents.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <AlertTriangle className="size-3.5 text-warning" /> Últimos eventos de risco
            </span>
            <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
              {overview.recentSafetyEvents.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2">
                  <span className="text-foreground">{auditActionLabels[e.action as keyof typeof auditActionLabels] ?? e.action}</span>
                  <span>{new Date(e.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {overview.recentFailures.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Últimas falhas da IA</span>
            <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
              {overview.recentFailures.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2">
                  <span className="text-foreground">{f.provider} · {f.errorCode ?? "erro"}</span>
                  <span>{new Date(f.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center gap-3 text-xs">
          <Link href="/auditoria?action=ASSIST_TRANSFERRED_TO_HUMAN" className="text-secondary hover:underline">
            Ver transferências na auditoria
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
