import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { PatientStatus } from "@/lib/generated/prisma/client"

export const patientStatusLabels: Record<PatientStatus, string> = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  ARCHIVED: "Arquivado",
}

const patientStatusStyles: Record<PatientStatus, string> = {
  ACTIVE: "bg-success/10 text-success",
  INACTIVE: "bg-warning/10 text-warning",
  ARCHIVED: "bg-muted text-muted-foreground",
}

export function PatientStatusBadge({ status }: { status: PatientStatus }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", patientStatusStyles[status])}>
      {patientStatusLabels[status]}
    </Badge>
  )
}
