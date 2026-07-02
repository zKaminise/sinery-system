import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { ClipboardList } from "lucide-react"

import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { getCurrentUser } from "@/lib/current-user"
import { canCreateService, canEditService, canChangeServiceStatus } from "@/lib/permissions"
import { ErrorState } from "@/components/common/error-state"
import { ServiceSummaryCards } from "@/components/services/service-summary-cards"
import { ServicesPageClient } from "@/components/services/services-page-client"
import type { ServiceRow } from "@/components/services/types"

export const metadata: Metadata = {
  title: "Serviços — Sinery System",
}

const PAGE_SIZE = 10

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ""
  return value ?? ""
}

export default async function ServicosPage({
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
  const durationFilter = firstParam(params.duration)
  const pageParam = Number.parseInt(firstParam(params.page), 10)
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1

  const durationValue = Number.parseInt(durationFilter, 10)

  // Tenant isolation: every query below is scoped to the logged-in user's
  // clinicId — a user can never list or count another clinic's services.
  const where = {
    clinicId: user.clinicId,
    ...(statusFilter ? { status: statusFilter as ServiceRow["status"] } : {}),
    ...(Number.isFinite(durationValue) && durationFilter ? { durationMinutes: durationValue } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { description: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  }

  let services: ServiceRow[] = []
  let total = 0
  const counts = { total: 0, active: 0, inactive: 0 }
  let averageDurationMinutes = 0
  let loadFailed = false

  try {
    const [items, count, grouped, avg] = await Promise.all([
      prisma.service.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          name: true,
          description: true,
          durationMinutes: true,
          priceInCents: true,
          status: true,
          createdAt: true,
          _count: { select: { professionals: true } },
        },
      }),
      prisma.service.count({ where }),
      prisma.service.groupBy({
        by: ["status"],
        where: { clinicId: user.clinicId },
        _count: true,
      }),
      prisma.service.aggregate({
        where: { clinicId: user.clinicId },
        _avg: { durationMinutes: true },
      }),
    ])

    services = items.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      durationMinutes: s.durationMinutes,
      priceInCents: s.priceInCents,
      status: s.status,
      professionalsCount: s._count.professionals,
      createdAt: s.createdAt.toISOString(),
    }))
    total = count
    averageDurationMinutes = avg._avg.durationMinutes ? Math.round(avg._avg.durationMinutes) : 0

    for (const g of grouped) {
      counts.total += g._count
      if (g.status === "ACTIVE") counts.active = g._count
      if (g.status === "INACTIVE") counts.inactive = g._count
    }
  } catch (error) {
    loadFailed = true
    logger.error("Falha ao carregar lista de serviços", {
      context: "services",
      error,
      metadata: { clinicId: user.clinicId },
    })
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ClipboardList className="size-5.5" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Serviços</h2>
          <p className="text-sm text-muted-foreground">
            Cadastre os serviços e procedimentos oferecidos pela clínica.
          </p>
        </div>
      </div>

      {loadFailed ? (
        <ErrorState description="Não foi possível carregar os serviços. Verifique a conexão com o banco e tente novamente." />
      ) : (
        <>
          <ServiceSummaryCards
            total={counts.total}
            active={counts.active}
            inactive={counts.inactive}
            averageDurationMinutes={averageDurationMinutes}
          />

          <ServicesPageClient
            services={services}
            total={total}
            page={page}
            totalPages={totalPages}
            filters={{ q, status: statusFilter, duration: durationFilter }}
            canCreate={canCreateService(user.role)}
            canEdit={canEditService(user.role)}
            canChangeStatus={canChangeServiceStatus(user.role)}
          />
        </>
      )}
    </div>
  )
}
