import type { LucideIcon } from "lucide-react"
import { CheckCircle2, CircleAlert, CircleHelp } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export type StatusLevel = "ok" | "error" | "unknown" | "warning"

interface SystemStatusCardProps {
  label: string
  status: StatusLevel
  value?: string
  description?: string
  icon?: LucideIcon
}

const statusConfig: Record<
  StatusLevel,
  { badge: string; dot: string; label: string; StatusIcon: LucideIcon; iconColor: string }
> = {
  ok: {
    badge: "bg-success/10 text-success",
    dot: "bg-success",
    label: "Operacional",
    StatusIcon: CheckCircle2,
    iconColor: "text-success",
  },
  error: {
    badge: "bg-destructive/10 text-destructive",
    dot: "bg-destructive",
    label: "Com falha",
    StatusIcon: CircleAlert,
    iconColor: "text-destructive",
  },
  unknown: {
    badge: "bg-warning/10 text-warning",
    dot: "bg-warning",
    label: "Verificando",
    StatusIcon: CircleHelp,
    iconColor: "text-warning",
  },
  warning: {
    badge: "bg-warning/10 text-warning",
    dot: "bg-warning",
    label: "Atenção",
    StatusIcon: CircleAlert,
    iconColor: "text-warning",
  },
}

export function SystemStatusCard({
  label,
  status,
  value,
  description,
  icon,
}: SystemStatusCardProps) {
  const config = statusConfig[status]
  const Icon = icon ?? config.StatusIcon

  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Icon className={cn("size-4.5", config.iconColor)} />
            <span className="text-sm text-muted-foreground">{label}</span>
          </div>
          <span className="text-lg font-semibold text-foreground">
            {value ?? config.label}
          </span>
          {description && (
            <span className="text-xs text-muted-foreground">{description}</span>
          )}
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
            config.badge
          )}
        >
          <span className={cn("size-1.5 rounded-full", config.dot)} />
          {config.label}
        </span>
      </CardContent>
    </Card>
  )
}
