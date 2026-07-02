import { ClipboardList, CheckCircle2, XCircle, Timer } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"

interface ServiceSummaryCardsProps {
  total: number
  active: number
  inactive: number
  averageDurationMinutes: number
}

export function ServiceSummaryCards({
  total,
  active,
  inactive,
  averageDurationMinutes,
}: ServiceSummaryCardsProps) {
  const items = [
    { label: "Total de serviços", value: String(total), icon: ClipboardList, accent: "bg-primary/10 text-primary" },
    { label: "Ativos", value: String(active), icon: CheckCircle2, accent: "bg-success/10 text-success" },
    { label: "Inativos", value: String(inactive), icon: XCircle, accent: "bg-warning/10 text-warning" },
    { label: "Duração média", value: `${averageDurationMinutes} min`, icon: Timer, accent: "bg-secondary/10 text-secondary" },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">{item.label}</span>
              <span className="text-2xl font-semibold tracking-tight text-foreground">
                {item.value}
              </span>
            </div>
            <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${item.accent}`}>
              <item.icon className="size-5" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
