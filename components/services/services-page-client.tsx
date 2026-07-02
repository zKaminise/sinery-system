"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { Plus, ClipboardList } from "lucide-react"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/empty-state"
import { ServicesFilters } from "@/components/services/services-filters"
import { ServicesTable } from "@/components/services/services-table"
import { ServiceFormDialog } from "@/components/services/service-form-dialog"
import type { ServiceRow } from "@/components/services/types"
import type { ServiceStatus } from "@/lib/generated/prisma/client"

interface ServicesPageClientProps {
  services: ServiceRow[]
  total: number
  page: number
  totalPages: number
  filters: { q: string; status: string; duration: string }
  canCreate: boolean
  canEdit: boolean
  canChangeStatus: boolean
}

export function ServicesPageClient({
  services,
  total,
  page,
  totalPages,
  filters,
  canCreate,
  canEdit,
  canChangeStatus,
}: ServicesPageClientProps) {
  const router = useRouter()
  const [formOpen, setFormOpen] = React.useState(false)
  const [formMode, setFormMode] = React.useState<"create" | "edit">("create")
  const [formInitial, setFormInitial] = React.useState<
    ({ id: string } & Partial<Record<string, string>>) | undefined
  >(undefined)
  const [busyId, setBusyId] = React.useState<string | null>(null)

  function openCreate() {
    setFormMode("create")
    setFormInitial(undefined)
    setFormOpen(true)
  }

  function openEdit(service: ServiceRow) {
    setFormMode("edit")
    setFormInitial({
      id: service.id,
      name: service.name,
      description: service.description ?? "",
      durationMinutes: String(service.durationMinutes),
      priceInReais: service.priceInCents != null ? (service.priceInCents / 100).toFixed(2) : "",
    })
    setFormOpen(true)
  }

  async function toggleStatus(service: ServiceRow) {
    const nextStatus: ServiceStatus = service.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
    setBusyId(service.id)
    try {
      const response = await fetch(`/api/services/${service.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.error?.message ?? "Não foi possível atualizar o serviço.")
        return
      }
      toast.success(nextStatus === "ACTIVE" ? "Serviço ativado." : "Serviço inativado.")
      router.refresh()
    } catch {
      toast.error("Erro de conexão. Tente novamente.")
    } finally {
      setBusyId(null)
    }
  }

  function pageHref(targetPage: number): string {
    const sp = new URLSearchParams()
    if (filters.q) sp.set("q", filters.q)
    if (filters.status) sp.set("status", filters.status)
    if (filters.duration) sp.set("duration", filters.duration)
    if (targetPage > 1) sp.set("page", String(targetPage))
    return `/servicos${sp.toString() ? `?${sp.toString()}` : ""}`
  }

  const hasFilters = Boolean(filters.q || filters.status || filters.duration)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ServicesFilters defaults={filters} />
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Novo serviço
          </Button>
        )}
      </div>

      {services.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={hasFilters ? "Nenhum serviço encontrado" : "Nenhum serviço cadastrado"}
          description={
            hasFilters
              ? "Ajuste a busca ou os filtros para encontrar o serviço desejado."
              : "Cadastre os serviços oferecidos pela clínica para organizar os agendamentos."
          }
          action={
            !hasFilters && canCreate ? (
              <Button onClick={openCreate}>
                <Plus className="size-4" />
                Cadastrar serviço
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <ServicesTable
            services={services}
            canEdit={canEdit}
            canChangeStatus={canChangeStatus}
            busyId={busyId}
            onEdit={openEdit}
            onToggleStatus={toggleStatus}
          />

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {total} {total === 1 ? "serviço encontrado" : "serviços encontrados"} · página{" "}
              {page} de {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                nativeButton={false}
                render={page <= 1 ? <span>Anterior</span> : <Link href={pageHref(page - 1)}>Anterior</Link>}
              />
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                nativeButton={false}
                render={
                  page >= totalPages ? <span>Próxima</span> : <Link href={pageHref(page + 1)}>Próxima</Link>
                }
              />
            </div>
          </div>
        </>
      )}

      <ServiceFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        initial={formInitial}
        onSaved={() => router.refresh()}
      />
    </div>
  )
}
