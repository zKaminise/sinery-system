import type { LucideIcon } from "lucide-react"
import {
  CalendarCheck2,
  BadgeCheck,
  Hourglass,
  Users,
  Stethoscope,
  ClipboardList,
  XCircle,
  UserX,
} from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { DashboardData } from "@/lib/dashboard/queries"

interface StatItem {
  label: string
  value: number
  icon: LucideIcon
  accent: string
}

function StatCard({ label, value, icon: Icon, accent }: StatItem) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">{label}</span>
          <span className="text-2xl font-semibold tracking-tight text-foreground">{value}</span>
        </div>
        <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", accent)}>
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  )
}

interface DashboardSummaryCardsProps {
  summary: DashboardData["summary"]
}

export function DashboardSummaryCards({ summary }: DashboardSummaryCardsProps) {
  const mainItems: StatItem[] = [
    {
      label: "Consultas hoje",
      value: summary.appointmentsToday,
      icon: CalendarCheck2,
      accent: "bg-primary/10 text-primary",
    },
    {
      label: "Confirmadas hoje",
      value: summary.confirmedToday,
      icon: BadgeCheck,
      accent: "bg-success/10 text-success",
    },
    {
      label: "Aguardando confirmação",
      value: summary.pendingConfirmationToday,
      icon: Hourglass,
      accent: "bg-warning/10 text-warning",
    },
    {
      label: "Pacientes ativos",
      value: summary.activePatients,
      icon: Users,
      accent: "bg-secondary/10 text-secondary",
    },
  ]

  const secondaryItems: StatItem[] = [
    {
      label: "Profissionais ativos",
      value: summary.activeProfessionals,
      icon: Stethoscope,
      accent: "bg-primary/10 text-primary",
    },
    {
      label: "Serviços ativos",
      value: summary.activeServices,
      icon: ClipboardList,
      accent: "bg-secondary/10 text-secondary",
    },
    {
      label: "Cancelamentos da semana",
      value: summary.cancelledThisWeek,
      icon: XCircle,
      accent: "bg-destructive/10 text-destructive",
    },
    {
      label: "Faltas da semana",
      value: summary.noShowThisWeek,
      icon: UserX,
      accent: "bg-warning/10 text-warning",
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {mainItems.map((item) => (
          <StatCard key={item.label} {...item} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {secondaryItems.map((item) => (
          <StatCard key={item.label} {...item} />
        ))}
      </div>
    </div>
  )
}
