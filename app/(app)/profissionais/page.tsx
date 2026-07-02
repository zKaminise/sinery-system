import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Stethoscope } from "lucide-react"

import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { getCurrentUser } from "@/lib/current-user"
import {
  canCreateProfessional,
  canEditProfessional,
  canChangeProfessionalStatus,
} from "@/lib/permissions"
import { ErrorState } from "@/components/common/error-state"
import { ProfessionalSummaryCards } from "@/components/professionals/professional-summary-cards"
import { ProfessionalsPageClient } from "@/components/professionals/professionals-page-client"
import type { ProfessionalRow } from "@/components/professionals/types"

export const metadata: Metadata = {
  title: "Profissionais — Sinery System",
}

const PAGE_SIZE = 10

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ""
  return value ?? ""
}

export default async function ProfissionaisPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await getCurrentUser()
  if (!user) {
    // Not a direct redirect("/login") — see app/(app)/layout.tsx.
    redirect("/api/auth/clear-session")
  }

  const params = await searchParams
  const q = firstParam(params.q).trim()
  const statusFilter = firstParam(params.status)
  const pageParam = Number.parseInt(firstParam(params.page), 10)
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1

  const qDigits = q.replace(/\D/g, "")
  const orConditions = q
    ? [
        { name: { contains: q, mode: "insensitive" as const } },
        { email: { contains: q, mode: "insensitive" as const } },
        { specialty: { contains: q, mode: "insensitive" as const } },
        ...(qDigits ? [{ phone: { contains: qDigits } }] : []),
      ]
    : undefined

  // Tenant isolation: every query below is scoped to the logged-in user's
  // clinicId — a user can never list or count another clinic's professionals.
  const where = {
    clinicId: user.clinicId,
    ...(statusFilter ? { status: statusFilter as ProfessionalRow["status"] } : {}),
    ...(orConditions ? { OR: orConditions } : {}),
  }

  let professionals: ProfessionalRow[] = []
  let total = 0
  const counts = { total: 0, active: 0, inactive: 0 }
  let linkedServices = 0
  let loadFailed = false

  try {
    const [items, count, grouped, linkCount] = await Promise.all([
      prisma.professional.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          specialty: true,
          status: true,
          createdAt: true,
          _count: { select: { services: true } },
        },
      }),
      prisma.professional.count({ where }),
      prisma.professional.groupBy({
        by: ["status"],
        where: { clinicId: user.clinicId },
        _count: true,
      }),
      prisma.professionalService.count({ where: { clinicId: user.clinicId } }),
    ])

    professionals = items.map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      phone: p.phone,
      specialty: p.specialty,
      status: p.status,
      servicesCount: p._count.services,
      createdAt: p.createdAt.toISOString(),
    }))
    total = count
    linkedServices = linkCount

    for (const g of grouped) {
      counts.total += g._count
      if (g.status === "ACTIVE") counts.active = g._count
      if (g.status === "INACTIVE") counts.inactive = g._count
    }
  } catch (error) {
    loadFailed = true
    logger.error("Falha ao carregar lista de profissionais", {
      context: "professionals",
      error,
      metadata: { clinicId: user.clinicId },
    })
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Stethoscope className="size-5.5" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Profissionais</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie os profissionais da clínica e seus horários de atendimento.
          </p>
        </div>
      </div>

      {loadFailed ? (
        <ErrorState description="Não foi possível carregar os profissionais. Verifique a conexão com o banco e tente novamente." />
      ) : (
        <>
          <ProfessionalSummaryCards
            total={counts.total}
            active={counts.active}
            inactive={counts.inactive}
            linkedServices={linkedServices}
          />

          <ProfessionalsPageClient
            professionals={professionals}
            total={total}
            page={page}
            totalPages={totalPages}
            filters={{ q, status: statusFilter }}
            canCreate={canCreateProfessional(user.role)}
            canEdit={canEditProfessional(user.role)}
            canChangeStatus={canChangeProfessionalStatus(user.role)}
          />
        </>
      )}
    </div>
  )
}
