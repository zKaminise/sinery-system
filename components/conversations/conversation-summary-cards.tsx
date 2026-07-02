import type { LucideIcon } from "lucide-react"
import { MessagesSquare, Hourglass, Headset, Sparkles, CheckCheck } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { ConversationSummary } from "@/lib/conversations/queries"

interface SummaryItem {
  label: string
  value: number
  icon: LucideIcon
  accent: string
}

export function ConversationSummaryCards({ summary }: { summary: ConversationSummary }) {
  const items: SummaryItem[] = [
    { label: "Abertas", value: summary.open, icon: MessagesSquare, accent: "bg-primary/10 text-primary" },
    { label: "Aguardando humano", value: summary.waitingHuman, icon: Hourglass, accent: "bg-warning/10 text-warning" },
    { label: "Em atendimento", value: summary.humanHandling, icon: Headset, accent: "bg-primary/10 text-primary" },
    { label: "Com Sinery Assist", value: summary.aiHandling, icon: Sparkles, accent: "bg-secondary/10 text-secondary" },
    { label: "Encerradas na semana", value: summary.closedThisWeek, icon: CheckCheck, accent: "bg-muted text-muted-foreground" },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="flex items-center justify-between gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">{item.label}</span>
              <span className="text-xl font-semibold tracking-tight text-foreground">{item.value}</span>
            </div>
            <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", item.accent)}>
              <item.icon className="size-4.5" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
