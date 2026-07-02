import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { UserPlus, CalendarPlus, Stethoscope, ClipboardPlus, CalendarDays, History } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface QuickAction {
  label: string
  href: string
  icon: LucideIcon
}

interface QuickActionsProps {
  canCreatePatient: boolean
  canCreateProfessional: boolean
  canCreateService: boolean
  canManageAppointments: boolean
}

export function QuickActions({
  canCreatePatient,
  canCreateProfessional,
  canCreateService,
  canManageAppointments,
}: QuickActionsProps) {
  const actions: QuickAction[] = []

  if (canCreatePatient) {
    actions.push({ label: "Novo paciente", href: "/pacientes", icon: UserPlus })
  }
  if (canManageAppointments) {
    actions.push({ label: "Nova consulta", href: "/agenda", icon: CalendarPlus })
  }
  if (canCreateProfessional) {
    actions.push({ label: "Novo profissional", href: "/profissionais", icon: Stethoscope })
  }
  if (canCreateService) {
    actions.push({ label: "Novo serviço", href: "/servicos", icon: ClipboardPlus })
  }
  actions.push({ label: "Ver agenda", href: "/agenda", icon: CalendarDays })
  actions.push({ label: "Ver auditoria", href: "/auditoria", icon: History })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Atalhos rápidos</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {actions.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="flex flex-col items-center gap-2 rounded-xl border border-border px-3 py-4 text-center transition-colors hover:bg-muted/50"
          >
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <action.icon className="size-4.5" />
            </div>
            <span className="text-xs font-medium text-foreground">{action.label}</span>
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}
