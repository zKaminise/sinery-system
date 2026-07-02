import { Sparkles } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import type { DashboardData } from "@/lib/dashboard/queries"

interface AssistPreviewCardProps {
  assist: DashboardData["assist"]
}

export function AssistPreviewCard({ assist }: AssistPreviewCardProps) {
  const stats: { label: string; value: number }[] = [
    { label: "Atendimentos pela IA", value: assist.aiHandledConversations },
    { label: "Agendamentos pela IA", value: assist.aiScheduledAppointments },
    { label: "Conversas pendentes", value: assist.pendingConversations },
  ]

  return (
    <Card className="border-secondary/20 bg-secondary/5">
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary/15 text-secondary">
            <Sparkles className="size-5.5" />
          </div>
          <div className="max-w-xl">
            <h3 className="text-sm font-semibold text-foreground">Sinery Assist em preparação</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Em breve, a Sinery Assist ajudará sua clínica a responder pacientes, consultar
              horários e apoiar agendamentos com IA integrada ao WhatsApp.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-lg border border-border bg-card px-3 py-2.5">
              <p className="text-lg font-semibold tracking-tight text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
