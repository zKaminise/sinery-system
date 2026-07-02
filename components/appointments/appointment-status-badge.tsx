import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { AppointmentStatus } from "@/lib/generated/prisma/client"

export const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  SCHEDULED: "Agendada",
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
  RESCHEDULED: "Remarcada",
  COMPLETED: "Concluída",
  NO_SHOW: "Falta",
}

const appointmentStatusStyles: Record<AppointmentStatus, string> = {
  SCHEDULED: "bg-primary/10 text-primary",
  CONFIRMED: "bg-success/10 text-success",
  RESCHEDULED: "bg-secondary/10 text-secondary",
  CANCELLED: "bg-destructive/10 text-destructive",
  COMPLETED: "bg-success/15 text-success",
  NO_SHOW: "bg-warning/10 text-warning",
}

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", appointmentStatusStyles[status])}>
      {appointmentStatusLabels[status]}
    </Badge>
  )
}
