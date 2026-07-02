import { BarChart3 } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { DashboardData } from "@/lib/dashboard/queries"

interface WeeklySummaryProps {
  week: DashboardData["week"]
}

export function WeeklySummary({ week }: WeeklySummaryProps) {
  const rows: { label: string; value: number; accent: string }[] = [
    { label: "Total de consultas", value: week.total, accent: "bg-primary" },
    { label: "Confirmadas", value: week.confirmed, accent: "bg-success" },
    { label: "Canceladas", value: week.cancelled, accent: "bg-destructive" },
    { label: "Concluídas", value: week.completed, accent: "bg-secondary" },
    { label: "Faltas", value: week.noShow, accent: "bg-warning" },
  ]
  const max = Math.max(week.total, 1)

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <BarChart3 className="size-4.5 text-primary" />
        <CardTitle>Resumo da semana</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-medium text-foreground">{row.value}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full transition-all", row.accent)}
                style={{ width: `${Math.round((row.value / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
