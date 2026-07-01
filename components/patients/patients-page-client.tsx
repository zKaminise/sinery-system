"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { UserPlus, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/empty-state"
import { PatientsFilters } from "@/components/patients/patients-filters"
import { PatientsTable } from "@/components/patients/patients-table"
import { PatientFormDialog } from "@/components/patients/patient-form-dialog"
import type { PatientRow } from "@/components/patients/types"
import type { PatientStatus } from "@/lib/generated/prisma/client"

interface PatientsPageClientProps {
  patients: PatientRow[]
  total: number
  page: number
  totalPages: number
  filters: { q: string; status: string; source: string }
  canCreate: boolean
  canEdit: boolean
  canChangeStatus: boolean
  canArchive: boolean
}

export function PatientsPageClient({
  patients,
  total,
  page,
  totalPages,
  filters,
  canCreate,
  canEdit,
  canChangeStatus,
  canArchive,
}: PatientsPageClientProps) {
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

  function openEdit(patient: PatientRow) {
    setFormMode("edit")
    setFormInitial({
      id: patient.id,
      name: patient.name,
      phone: patient.phone,
      email: patient.email ?? "",
      document: patient.document ?? "",
      birthDate: patient.birthDate ? patient.birthDate.slice(0, 10) : "",
      source: patient.source ?? "",
      notes: patient.notes ?? "",
    })
    setFormOpen(true)
  }

  async function changeStatus(patient: PatientRow, status: PatientStatus) {
    setBusyId(patient.id)
    try {
      const response = await fetch(`/api/patients/${patient.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.error?.message ?? "Não foi possível atualizar o paciente.")
        return
      }
      toast.success(
        status === "ARCHIVED"
          ? "Paciente arquivado."
          : status === "ACTIVE"
            ? "Paciente ativado."
            : "Paciente inativado."
      )
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
    if (filters.source) sp.set("source", filters.source)
    if (targetPage > 1) sp.set("page", String(targetPage))
    return `/pacientes${sp.toString() ? `?${sp.toString()}` : ""}`
  }

  const hasFilters = Boolean(filters.q || filters.status || filters.source)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PatientsFilters defaults={filters} />
        {canCreate && (
          <Button onClick={openCreate}>
            <UserPlus className="size-4" />
            Novo paciente
          </Button>
        )}
      </div>

      {patients.length === 0 ? (
        <EmptyState
          icon={Users}
          title={hasFilters ? "Nenhum paciente encontrado" : "Nenhum paciente cadastrado"}
          description={
            hasFilters
              ? "Ajuste a busca ou os filtros para encontrar o paciente desejado."
              : "Cadastre o primeiro paciente para começar a organizar a operação da clínica."
          }
          action={
            !hasFilters && canCreate ? (
              <Button onClick={openCreate}>
                <UserPlus className="size-4" />
                Cadastrar paciente
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <PatientsTable
            patients={patients}
            canEdit={canEdit}
            canChangeStatus={canChangeStatus}
            canArchive={canArchive}
            busyId={busyId}
            onEdit={openEdit}
            onToggleStatus={(p) => changeStatus(p, p.status === "ACTIVE" ? "INACTIVE" : "ACTIVE")}
            onArchive={(p) => changeStatus(p, "ARCHIVED")}
          />

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {total} {total === 1 ? "paciente encontrado" : "pacientes encontrados"} · página{" "}
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

      <PatientFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        initial={formInitial}
        onSaved={() => router.refresh()}
      />
    </div>
  )
}
