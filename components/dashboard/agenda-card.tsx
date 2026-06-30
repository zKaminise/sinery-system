import { CalendarDays } from "lucide-react"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { todayAgenda, type AgendaStatus } from "@/lib/mock-data"

const statusStyles: Record<AgendaStatus, string> = {
  Confirmado: "bg-success/10 text-success",
  Aguardando: "bg-warning/10 text-warning",
  "Em atendimento": "bg-secondary/10 text-secondary",
  Concluído: "bg-muted text-muted-foreground",
}

export function AgendaCard() {
  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <CalendarDays className="size-4.5 text-primary" />
        <CardTitle>Agenda de hoje</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {todayAgenda.map((item) => (
          <div
            key={`${item.time}-${item.patient}`}
            className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-12 shrink-0 text-sm font-medium text-foreground">
                {item.time}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {item.patient}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {item.service} · {item.professional}
                </p>
              </div>
            </div>
            <Badge
              variant="outline"
              className={cn("shrink-0 border-transparent", statusStyles[item.status])}
            >
              {item.status}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
