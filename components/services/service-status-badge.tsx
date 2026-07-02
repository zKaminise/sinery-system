import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ServiceStatus } from "@/lib/generated/prisma/client"

export const serviceStatusLabels: Record<ServiceStatus, string> = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
}

const serviceStatusStyles: Record<ServiceStatus, string> = {
  ACTIVE: "bg-success/10 text-success",
  INACTIVE: "bg-muted text-muted-foreground",
}

export function ServiceStatusBadge({ status }: { status: ServiceStatus }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", serviceStatusStyles[status])}>
      {serviceStatusLabels[status]}
    </Badge>
  )
}
