import { Building2, TriangleAlert } from "lucide-react"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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

interface ClinicCardProps {
  clinic: Clinic | null
  dbError?: boolean
}

export function ClinicCard({ clinic, dbError }: ClinicCardProps) {
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <Building2 className="size-4.5 text-primary" />
        <CardTitle>Clínica atual</CardTitle>
      </CardHeader>
      <CardContent>
        {clinic ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-foreground">{clinic.name}</p>
              <p className="text-sm text-muted-foreground">
                {segmentLabels[clinic.segment]} · slug: {clinic.slug}
              </p>
            </div>
            <Badge variant="outline" className={cn("border-transparent", statusStyles[clinic.status])}>
              {statusLabels[clinic.status]}
            </Badge>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
              <TriangleAlert className="size-4.5" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {dbError
                  ? "Não foi possível conectar ao banco de dados"
                  : "Nenhuma clínica encontrada"}
              </p>
              <p className="text-sm text-muted-foreground">
                {dbError
                  ? "Verifique se o PostgreSQL está rodando e se DATABASE_URL está configurado em .env."
                  : "Rode \"npm run db:seed\" para criar a clínica de demonstração."}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
