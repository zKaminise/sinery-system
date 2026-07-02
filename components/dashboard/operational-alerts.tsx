import Link from "next/link"
import { TriangleAlert, CheckCircle2 } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { DashboardData } from "@/lib/dashboard/queries"

interface AlertRow {
  text: string
  href?: string
}

interface OperationalAlertsProps {
  alerts: DashboardData["alerts"]
}

export function OperationalAlerts({ alerts }: OperationalAlertsProps) {
  const rows: AlertRow[] = []

  if (alerts.pendingConfirmationUpcoming > 0) {
    rows.push({
      text: `${alerts.pendingConfirmationUpcoming} ${alerts.pendingConfirmationUpcoming === 1 ? "consulta está aguardando" : "consultas estão aguardando"} confirmação.`,
      href: "/agenda?status=SCHEDULED",
    })
  }
  if (alerts.cancelledLast7Days > 0) {
    rows.push({
      text: `${alerts.cancelledLast7Days} ${alerts.cancelledLast7Days === 1 ? "consulta foi cancelada" : "consultas foram canceladas"} nos últimos 7 dias.`,
      href: "/agenda?view=list&status=CANCELLED",
    })
  }
  for (const p of alerts.professionalsWithoutWorkingHours) {
    rows.push({
      text: `O profissional ${p.name} ainda não possui horários de atendimento cadastrados.`,
      href: `/profissionais/${p.id}`,
    })
  }
  for (const p of alerts.professionalsWithoutServices) {
    rows.push({
      text: `O profissional ${p.name} ainda não possui serviços vinculados.`,
      href: `/profissionais/${p.id}`,
    })
  }
  for (const s of alerts.servicesWithoutProfessionals) {
    rows.push({
      text: `O serviço ${s.name} ainda não possui profissional vinculado.`,
      href: `/servicos/${s.id}`,
    })
  }
  if (alerts.archivedPatients > 0) {
    rows.push({
      text: `${alerts.archivedPatients} ${alerts.archivedPatients === 1 ? "paciente arquivado" : "pacientes arquivados"} na base da clínica.`,
      href: "/pacientes?status=ARCHIVED",
    })
  }

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <TriangleAlert className="size-4.5 text-warning" />
        <CardTitle>Alertas operacionais</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {rows.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/5 px-3 py-2.5 text-sm text-success">
            <CheckCircle2 className="size-4 shrink-0" />
            Nenhum alerta no momento. Tudo em ordem.
          </div>
        ) : (
          rows.map((row, index) => {
            const content = (
              <div className="flex items-start gap-2 rounded-lg border border-warning/20 bg-warning/5 px-3 py-2.5 text-sm text-foreground">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
                <span>{row.text}</span>
              </div>
            )
            return row.href ? (
              <Link key={index} href={row.href} className="transition-opacity hover:opacity-80">
                {content}
              </Link>
            ) : (
              <div key={index}>{content}</div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
