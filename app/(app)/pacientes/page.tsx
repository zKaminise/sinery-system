import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Users } from "lucide-react"

import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { getCurrentUser } from "@/lib/current-user"
import {
  canCreatePatient,
  canEditPatient,
  canChangePatientStatus,
  canArchivePatient,
} from "@/lib/permissions"
import { ErrorState } from "@/components/common/error-state"
import { PatientSummaryCards } from "@/components/patients/patient-summary-cards"
import { PatientsPageClient } from "@/components/patients/patients-page-client"
import type { PatientRow } from "@/components/patients/types"

export const metadata: Metadata = {
  title: "Pacientes — Sinery System",
}

const PAGE_SIZE = 10

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ""
  return value ?? ""
}

export default async function PacientesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/login")
  }

  const params = await searchParams
  const q = firstParam(params.q).trim()
  const statusFilter = firstParam(params.status)
  const sourceFilter = firstParam(params.source)
  const pageParam = Number.parseInt(firstParam(params.page), 10)
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1

  // Text search covers name/email/document; phone is matched separately
  // against a digits-only version of the query, since stored phones are
  // digits-only but staff may type them with spaces/dashes/parentheses.
  const qDigits = q.replace(/\D/g, "")
  const orConditions = q
    ? [
        { name: { contains: q, mode: "insensitive" as const } },
        { email: { contains: q, mode: "insensitive" as const } },
        { document: { contains: q, mode: "insensitive" as const } },
        ...(qDigits ? [{ phone: { contains: qDigits } }] : []),
      ]
    : undefined

  // Tenant isolation: every query below is scoped to the logged-in user's
  // clinicId — a user can never list or count another clinic's patients.
  const where = {
    clinicId: user.clinicId,
    ...(statusFilter ? { status: statusFilter as PatientRow["status"] } : {}),
    ...(sourceFilter ? { source: sourceFilter } : {}),
    ...(orConditions ? { OR: orConditions } : {}),
  }

  let patients: PatientRow[] = []
  let total = 0
  const counts = { total: 0, active: 0, inactive: 0, archived: 0 }
  let loadFailed = false

  try {
    const [items, count, grouped] = await Promise.all([
      prisma.patient.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          document: true,
          birthDate: true,
          source: true,
          notes: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.patient.count({ where }),
      prisma.patient.groupBy({
        by: ["status"],
        where: { clinicId: user.clinicId },
        _count: true,
      }),
    ])

    patients = items.map((p) => ({
      id: p.id,
      name: p.name,
      phone: p.phone,
      email: p.email,
      document: p.document,
      birthDate: p.birthDate ? p.birthDate.toISOString() : null,
      source: p.source,
      notes: p.notes,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
    }))
    total = count

    for (const g of grouped) {
      counts.total += g._count
      if (g.status === "ACTIVE") counts.active = g._count
      if (g.status === "INACTIVE") counts.inactive = g._count
      if (g.status === "ARCHIVED") counts.archived = g._count
    }
  } catch (error) {
    loadFailed = true
    logger.error("Falha ao carregar lista de pacientes", {
      context: "patients",
      error,
      metadata: { clinicId: user.clinicId },
    })
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Users className="size-5.5" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Pacientes</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie os pacientes cadastrados na sua clínica.
          </p>
        </div>
      </div>

      {loadFailed ? (
        <ErrorState description="Não foi possível carregar os pacientes. Verifique a conexão com o banco e tente novamente." />
      ) : (
        <>
          <PatientSummaryCards
            total={counts.total}
            active={counts.active}
            inactive={counts.inactive}
            archived={counts.archived}
          />

          <PatientsPageClient
            patients={patients}
            total={total}
            page={page}
            totalPages={totalPages}
            filters={{ q, status: statusFilter, source: sourceFilter }}
            canCreate={canCreatePatient(user.role)}
            canEdit={canEditPatient(user.role)}
            canChangeStatus={canChangePatientStatus(user.role)}
            canArchive={canArchivePatient(user.role)}
          />
        </>
      )}
    </div>
  )
}
