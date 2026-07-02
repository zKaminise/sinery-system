"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { UserPlus, Stethoscope } from "lucide-react"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/empty-state"
import { ProfessionalsFilters } from "@/components/professionals/professionals-filters"
import { ProfessionalsTable } from "@/components/professionals/professionals-table"
import { ProfessionalFormDialog } from "@/components/professionals/professional-form-dialog"
import type { ProfessionalRow } from "@/components/professionals/types"
import type { ProfessionalStatus } from "@/lib/generated/prisma/client"

interface ProfessionalsPageClientProps {
  professionals: ProfessionalRow[]
  total: number
  page: number
  totalPages: number
  filters: { q: string; status: string }
  canCreate: boolean
  canEdit: boolean
  canChangeStatus: boolean
}

export function ProfessionalsPageClient({
  professionals,
  total,
  page,
  totalPages,
  filters,
  canCreate,
  canEdit,
  canChangeStatus,
}: ProfessionalsPageClientProps) {
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

  function openEdit(professional: ProfessionalRow) {
    setFormMode("edit")
    setFormInitial({
      id: professional.id,
      name: professional.name,
      email: professional.email ?? "",
      phone: professional.phone ?? "",
      specialty: professional.specialty ?? "",
    })
    setFormOpen(true)
  }

  async function toggleStatus(professional: ProfessionalRow) {
    const nextStatus: ProfessionalStatus = professional.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
    setBusyId(professional.id)
    try {
      const response = await fetch(`/api/professionals/${professional.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.error?.message ?? "Não foi possível atualizar o profissional.")
        return
      }
      toast.success(nextStatus === "ACTIVE" ? "Profissional ativado." : "Profissional inativado.")
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
    if (targetPage > 1) sp.set("page", String(targetPage))
    return `/profissionais${sp.toString() ? `?${sp.toString()}` : ""}`
  }

  const hasFilters = Boolean(filters.q || filters.status)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ProfessionalsFilters defaults={filters} />
        {canCreate && (
          <Button onClick={openCreate}>
            <UserPlus className="size-4" />
            Novo profissional
          </Button>
        )}
      </div>

      {professionals.length === 0 ? (
        <EmptyState
          icon={Stethoscope}
          title={hasFilters ? "Nenhum profissional encontrado" : "Nenhum profissional cadastrado"}
          description={
            hasFilters
              ? "Ajuste a busca ou os filtros para encontrar o profissional desejado."
              : "Cadastre os profissionais da clínica para começar a montar a agenda."
          }
          action={
            !hasFilters && canCreate ? (
              <Button onClick={openCreate}>
                <UserPlus className="size-4" />
                Cadastrar profissional
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <ProfessionalsTable
            professionals={professionals}
            canEdit={canEdit}
            canChangeStatus={canChangeStatus}
            busyId={busyId}
            onEdit={openEdit}
            onToggleStatus={toggleStatus}
          />

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {total} {total === 1 ? "profissional encontrado" : "profissionais encontrados"} ·
              página {page} de {totalPages}
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

      <ProfessionalFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        initial={formInitial}
        onSaved={() => router.refresh()}
      />
    </div>
  )
}
