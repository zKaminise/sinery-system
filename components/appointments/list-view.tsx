"use client"

import Link from "next/link"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AppointmentStatusBadge } from "@/components/appointments/appointment-status-badge"
import { AppointmentActions } from "@/components/appointments/appointment-actions"
import { EmptyState } from "@/components/common/empty-state"
import { CalendarDays } from "lucide-react"
import type { AppointmentItem } from "@/components/appointments/types"
import type { CreatedBySource } from "@/lib/generated/prisma/client"

const sourceLabels: Record<CreatedBySource, string> = {
  USER: "Manual",
  AI: "Sinery Assist",
  SYSTEM: "Sistema",
}

function formatDateBR(dateStr: string): string {
  const [y, m, d] = dateStr.split("-")
  return `${d}/${m}/${y}`
}

interface ListViewProps {
  appointments: AppointmentItem[]
  canManage: boolean
  onEdit: (appointment: AppointmentItem) => void
}

export function ListView({ appointments, canManage, onEdit }: ListViewProps) {
  if (appointments.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Nenhuma consulta encontrada"
        description="Ajuste a data, os filtros ou a busca para encontrar consultas."
      />
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <Table className="min-w-[900px]">
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Horário</TableHead>
            <TableHead>Paciente</TableHead>
            <TableHead>Serviço</TableHead>
            <TableHead>Profissional</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Origem</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {appointments.map((appt) => (
            <TableRow key={appt.id}>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {formatDateBR(appt.date)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {appt.startTime}–{appt.endTime}
              </TableCell>
              <TableCell className="font-medium text-foreground">
                <Link href={`/agenda/${appt.id}`} className="hover:underline">
                  {appt.patientName}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">{appt.serviceName ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">{appt.professionalName}</TableCell>
              <TableCell>
                <AppointmentStatusBadge status={appt.status} />
              </TableCell>
              <TableCell className="text-muted-foreground">
                {sourceLabels[appt.createdBySource]}
              </TableCell>
              <TableCell className="text-right">
                <AppointmentActions appointment={appt} canManage={canManage} onEdit={onEdit} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
