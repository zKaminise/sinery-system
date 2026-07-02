"use client"

import Link from "next/link"
import { MoreVertical, Eye, Pencil, UserCheck, UserX } from "lucide-react"

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
import { ProfessionalStatusBadge } from "@/components/professionals/professional-status-badge"
import type { ProfessionalRow } from "@/components/professionals/types"

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(iso))
}

interface ProfessionalsTableProps {
  professionals: ProfessionalRow[]
  canEdit: boolean
  canChangeStatus: boolean
  busyId: string | null
  onEdit: (professional: ProfessionalRow) => void
  onToggleStatus: (professional: ProfessionalRow) => void
}

export function ProfessionalsTable({
  professionals,
  canEdit,
  canChangeStatus,
  busyId,
  onEdit,
  onToggleStatus,
}: ProfessionalsTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <Table className="min-w-[900px]">
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Especialidade</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead>E-mail</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Serviços vinculados</TableHead>
            <TableHead>Criado em</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {professionals.map((professional) => {
            const hasActions = canEdit || canChangeStatus

            return (
              <TableRow key={professional.id}>
                <TableCell className="font-medium text-foreground">{professional.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {professional.specialty ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">{professional.phone ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{professional.email ?? "—"}</TableCell>
                <TableCell>
                  <ProfessionalStatusBadge status={professional.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">{professional.servicesCount}</TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(professional.createdAt)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Ver detalhes"
                      nativeButton={false}
                      render={<Link href={`/profissionais/${professional.id}`} />}
                    >
                      <Eye className="size-4" />
                    </Button>

                    {hasActions ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon" aria-label="Mais ações"
                              disabled={busyId === professional.id}>
                              <MoreVertical className="size-4" />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end" className="w-52">
                          {canEdit && (
                            <DropdownMenuItem onClick={() => onEdit(professional)}>
                              <Pencil className="size-4" /> Editar
                            </DropdownMenuItem>
                          )}
                          {canChangeStatus && (
                            <DropdownMenuItem onClick={() => onToggleStatus(professional)}>
                              {professional.status === "ACTIVE" ? (
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
