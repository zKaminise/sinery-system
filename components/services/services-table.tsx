"use client"

import Link from "next/link"
import { MoreVertical, Eye, Pencil, CheckCircle2, XCircle } from "lucide-react"

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
import { ServiceStatusBadge } from "@/components/services/service-status-badge"
import { formatPriceFromCents } from "@/lib/utils"
import type { ServiceRow } from "@/components/services/types"

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(iso))
}

interface ServicesTableProps {
  services: ServiceRow[]
  canEdit: boolean
  canChangeStatus: boolean
  busyId: string | null
  onEdit: (service: ServiceRow) => void
  onToggleStatus: (service: ServiceRow) => void
}

export function ServicesTable({
  services,
  canEdit,
  canChangeStatus,
  busyId,
  onEdit,
  onToggleStatus,
}: ServicesTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <Table className="min-w-[860px]">
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Duração</TableHead>
            <TableHead>Preço</TableHead>
            <TableHead>Profissionais vinculados</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Criado em</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {services.map((service) => {
            const hasActions = canEdit || canChangeStatus

            return (
              <TableRow key={service.id}>
                <TableCell className="font-medium text-foreground">{service.name}</TableCell>
                <TableCell className="text-muted-foreground">{service.durationMinutes} min</TableCell>
                <TableCell className="text-muted-foreground">
                  {formatPriceFromCents(service.priceInCents)}
                </TableCell>
                <TableCell className="text-muted-foreground">{service.professionalsCount}</TableCell>
                <TableCell>
                  <ServiceStatusBadge status={service.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDate(service.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Ver detalhes"
                      nativeButton={false}
                      render={<Link href={`/servicos/${service.id}`} />}
                    >
                      <Eye className="size-4" />
                    </Button>

                    {hasActions ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon" aria-label="Mais ações"
                              disabled={busyId === service.id}>
                              <MoreVertical className="size-4" />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end" className="w-52">
                          {canEdit && (
                            <DropdownMenuItem onClick={() => onEdit(service)}>
                              <Pencil className="size-4" /> Editar
                            </DropdownMenuItem>
                          )}
                          {canChangeStatus && (
                            <DropdownMenuItem onClick={() => onToggleStatus(service)}>
                              {service.status === "ACTIVE" ? (
                                <>
                                  <XCircle className="size-4" /> Inativar
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="size-4" /> Ativar
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
