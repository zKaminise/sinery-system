import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ProfessionalStatus } from "@/lib/generated/prisma/client"

export const professionalStatusLabels: Record<ProfessionalStatus, string> = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
}

const professionalStatusStyles: Record<ProfessionalStatus, string> = {
  ACTIVE: "bg-success/10 text-success",
  INACTIVE: "bg-muted text-muted-foreground",
}

export function ProfessionalStatusBadge({ status }: { status: ProfessionalStatus }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", professionalStatusStyles[status])}>
      {professionalStatusLabels[status]}
    </Badge>
  )
}
