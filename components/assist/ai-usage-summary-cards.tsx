import { Activity, Coins, CircleCheck, CircleX, UserRound, Wrench, ShieldAlert, Hash } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import type { AiUsageSummary } from "@/lib/ai/assist-usage-queries"

function formatCents(cents: number): string {
  return `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const items = (s: AiUsageSummary) => [
  { label: "Chamadas hoje", value: String(s.callsToday), icon: Activity, tone: "text-secondary" },
  { label: "Tokens hoje", value: s.tokensToday.toLocaleString("pt-BR"), icon: Hash, tone: "text-secondary" },
  { label: "Custo estimado hoje", value: formatCents(s.estimatedCostTodayCents), icon: Coins, tone: "text-primary" },
  { label: "Com sucesso", value: String(s.successToday), icon: CircleCheck, tone: "text-success" },
  { label: "Com erro", value: String(s.errorToday), icon: CircleX, tone: s.errorToday > 0 ? "text-destructive" : "text-muted-foreground" },
  { label: "Transferências p/ humano", value: String(s.fallbacksToHuman), icon: UserRound, tone: "text-warning" },
  { label: "Ferramentas hoje", value: String(s.toolsToday), icon: Wrench, tone: "text-secondary" },
  { label: "Msgs sensíveis hoje", value: String(s.sensitiveToday), icon: ShieldAlert, tone: s.sensitiveToday > 0 ? "text-destructive" : "text-muted-foreground" },
]

export function AiUsageSummaryCards({ summary }: { summary: AiUsageSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items(summary).map((it) => (
        <Card key={it.label}>
          <CardContent className="flex flex-col gap-1 p-4">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <it.icon className={`size-3.5 ${it.tone}`} /> {it.label}
            </span>
            <span className="text-xl font-semibold text-foreground">{it.value}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
