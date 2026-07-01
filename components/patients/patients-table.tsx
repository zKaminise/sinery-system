"use client"

import Link from "next/link"
import { MoreVertical, Eye, Pencil, UserCheck, UserX, Archive } from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PatientStatusBadge } from "@/components/patients/patient-status-badge"
import type { PatientRow } from "@/components/patients/types"

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(iso))
}

interface PatientsTableProps {
  patients: PatientRow[]
  canEdit: boolean
  canChangeStatus: boolean
  canArchive: boolean
  busyId: string | null
  onEdit: (patient: PatientRow) => void
  onToggleStatus: (patient: PatientRow) => void
  onArchive: (patient: PatientRow) => void
}

export function PatientsTable({
  patients,
  canEdit,
  canChangeStatus,
  canArchive,
  busyId,
  onEdit,
  onToggleStatus,
  onArchive,
}: PatientsTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <Table className="min-w-[820px]">
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead>E-mail</TableHead>
            <TableHead>Origem</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Criado em</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {patients.map((patient) => {
            const isArchived = patient.status === "ARCHIVED"
            const showEdit = canEdit && !isArchived
            const showToggle = canChangeStatus && !isArchived
            const showArchive = canArchive && !isArchived
            const hasActions = showEdit || showToggle || showArchive

            return (
              <TableRow key={patient.id}>
                <TableCell className="font-medium text-foreground">{patient.name}</TableCell>
                <TableCell className="text-muted-foreground">{patient.phone}</TableCell>
                <TableCell className="text-muted-foreground">{patient.email ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {patient.source ?? "Não informada"}
                </TableCell>
                <TableCell>
                  <PatientStatusBadge status={patient.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(patient.createdAt)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Ver detalhes"
                      nativeButton={false}
                      render={<Link href={`/pacientes/${patient.id}`} />}
                    >
                      <Eye className="size-4" />
                    </Button>

                    {hasActions ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon" aria-label="Mais ações"
                              disabled={busyId === patient.id}>
                              <MoreVertical className="size-4" />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end" className="w-52">
                          {showEdit && (
                            <DropdownMenuItem onClick={() => onEdit(patient)}>
                              <Pencil className="size-4" /> Editar
                            </DropdownMenuItem>
                          )}
                          {showToggle && (
                            <DropdownMenuItem onClick={() => onToggleStatus(patient)}>
                              {patient.status === "ACTIVE" ? (
                                <>
                                  <UserX className="size-4" /> Inativar
                                </>
                              ) : (
                                <>
                                  <UserCheck className="size-4" /> Ativar
                                </>
                              )}
                            </DropdownMenuItem>
                          )}
                          {showArchive && (
                            <DropdownMenuItem variant="destructive" onClick={() => onArchive(patient)}>
                              <Archive className="size-4" /> Arquivar
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
