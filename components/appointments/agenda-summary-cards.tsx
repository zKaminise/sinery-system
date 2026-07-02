import { CalendarDays, CheckCircle2, Clock, XCircle, UserX } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"

interface AgendaSummaryCardsProps {
  today: number
  confirmed: number
  awaiting: number
  cancelled: number
  noShow: number
}

export function AgendaSummaryCards({
  today,
  confirmed,
  awaiting,
  cancelled,
  noShow,
}: AgendaSummaryCardsProps) {
  const items = [
    { label: "Consultas hoje", value: today, icon: CalendarDays, accent: "bg-primary/10 text-primary" },
    { label: "Confirmadas", value: confirmed, icon: CheckCircle2, accent: "bg-success/10 text-success" },
    { label: "Aguardando confirmação", value: awaiting, icon: Clock, accent: "bg-secondary/10 text-secondary" },
    { label: "Canceladas", value: cancelled, icon: XCircle, accent: "bg-destructive/10 text-destructive" },
    { label: "Faltas", value: noShow, icon: UserX, accent: "bg-warning/10 text-warning" },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="flex items-start justify-between gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">{item.label}</span>
              <span className="text-2xl font-semibold tracking-tight text-foreground">
                {item.value}
              </span>
            </div>
            <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${item.accent}`}>
              <item.icon className="size-4.5" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
