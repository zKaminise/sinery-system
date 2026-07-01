import { Users, UserCheck, UserX, Archive } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"

interface PatientSummaryCardsProps {
  total: number
  active: number
  inactive: number
  archived: number
}

export function PatientSummaryCards({
  total,
  active,
  inactive,
  archived,
}: PatientSummaryCardsProps) {
  const items = [
    { label: "Total de pacientes", value: total, icon: Users, accent: "bg-primary/10 text-primary" },
    { label: "Ativos", value: active, icon: UserCheck, accent: "bg-success/10 text-success" },
    { label: "Inativos", value: inactive, icon: UserX, accent: "bg-warning/10 text-warning" },
    { label: "Arquivados", value: archived, icon: Archive, accent: "bg-muted text-muted-foreground" },
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
