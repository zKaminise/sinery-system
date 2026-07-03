import type { LucideIcon } from "lucide-react"
import { Sparkles, CalendarPlus, UserCog } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { AssistSummary } from "@/lib/assist/queries"

export function AssistSummaryCards({ summary }: { summary: AssistSummary }) {
  const items: { label: string; value: number; icon: LucideIcon; accent: string }[] = [
    { label: "Conversas simuladas", value: summary.simulations, icon: Sparkles, accent: "bg-secondary/10 text-secondary" },
    { label: "Agendamentos pela Assist", value: summary.aiScheduled, icon: CalendarPlus, accent: "bg-primary/10 text-primary" },
    { label: "Transferências para humano", value: summary.transferredToHuman, icon: UserCog, accent: "bg-warning/10 text-warning" },
  ]

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="flex items-center justify-between gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">{item.label}</span>
              <span className="text-2xl font-semibold tracking-tight text-foreground">{item.value}</span>
            </div>
            <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", item.accent)}>
              <item.icon className="size-5" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
