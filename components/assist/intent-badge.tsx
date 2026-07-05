import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { AssistIntent } from "@/lib/assist/types"

export const intentLabels: Record<AssistIntent, string> = {
  SCHEDULE_APPOINTMENT: "Agendamento",
  RESCHEDULE_APPOINTMENT: "Remarcação",
  CANCEL_APPOINTMENT: "Cancelamento",
  CONFIRM_APPOINTMENT: "Confirmação",
  ASK_SERVICES: "Serviços",
  ASK_ADDRESS: "Endereço",
  ASK_HOURS: "Horários",
  ASK_PRICE: "Preço",
  HUMAN_HELP: "Falar com humano",
  EMERGENCY_OR_SENSITIVE: "Emergência / sensível",
  UNKNOWN: "Não identificada",
}

const intentStyles: Record<AssistIntent, string> = {
  SCHEDULE_APPOINTMENT: "bg-primary/10 text-primary",
  RESCHEDULE_APPOINTMENT: "bg-secondary/10 text-secondary",
  CANCEL_APPOINTMENT: "bg-destructive/10 text-destructive",
  CONFIRM_APPOINTMENT: "bg-success/10 text-success",
  ASK_SERVICES: "bg-muted text-muted-foreground",
  ASK_ADDRESS: "bg-muted text-muted-foreground",
  ASK_HOURS: "bg-muted text-muted-foreground",
  ASK_PRICE: "bg-muted text-muted-foreground",
  HUMAN_HELP: "bg-warning/10 text-warning",
  EMERGENCY_OR_SENSITIVE: "bg-destructive/10 text-destructive",
  UNKNOWN: "bg-warning/10 text-warning",
}

export function IntentBadge({ intent }: { intent: AssistIntent }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", intentStyles[intent])}>
      {intentLabels[intent]}
    </Badge>
  )
}
