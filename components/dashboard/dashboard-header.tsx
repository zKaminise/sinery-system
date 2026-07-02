import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Clinic } from "@/lib/generated/prisma/client"

const segmentLabels: Record<Clinic["segment"], string> = {
  ODONTOLOGY: "Odontologia",
  PHYSIOTHERAPY: "Fisioterapia",
  AESTHETICS: "Estética",
  PSYCHOLOGY: "Psicologia",
  MEDICAL: "Clínica médica",
  OTHER: "Outro",
}

const statusStyles: Record<Clinic["status"], string> = {
  ACTIVE: "bg-success/10 text-success",
  SETUP_PENDING: "bg-warning/10 text-warning",
  INACTIVE: "bg-muted text-muted-foreground",
  SUSPENDED: "bg-destructive/10 text-destructive",
}

const statusLabels: Record<Clinic["status"], string> = {
  ACTIVE: "Ativa",
  SETUP_PENDING: "Configuração pendente",
  INACTIVE: "Inativa",
  SUSPENDED: "Suspensa",
}

/** "Bom dia" / "Boa tarde" / "Boa noite" based on the clinic-local hour. */
function greetingForHour(hour: number): string {
  if (hour < 12) return "Bom dia"
  if (hour < 18) return "Boa tarde"
  return "Boa noite"
}

interface DashboardHeaderProps {
  userName: string
  hour: number
  clinic: Clinic | null
  dbError?: boolean
}

export function DashboardHeader({ userName, hour, clinic, dbError }: DashboardHeaderProps) {
  const firstName = userName.split(" ")[0]

  return (
    <div className="flex flex-col gap-1.5">
      <h2 className="text-xl font-semibold tracking-tight text-foreground">
        {greetingForHour(hour)}, {firstName}
      </h2>
      {clinic ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>
            {clinic.name} · {segmentLabels[clinic.segment]}
          </span>
          <Badge variant="outline" className={cn("border-transparent", statusStyles[clinic.status])}>
            {statusLabels[clinic.status]}
          </Badge>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {dbError
            ? "Não foi possível conectar ao banco de dados."
            : "Nenhuma clínica encontrada para este usuário."}
        </p>
      )}
    </div>
  )
}
