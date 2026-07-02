import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ScrollText } from "lucide-react"

import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"
import { getCurrentUser } from "@/lib/current-user"
import { AccessDenied } from "@/components/common/access-denied"
import { ErrorState } from "@/components/common/error-state"
import { AuditLogTable, type AuditLogRow } from "@/components/audit/audit-log-table"
import { AuditLogFilters } from "@/components/audit/audit-log-filters"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Auditoria — Sinery System",
}

const PAGE_SIZE = 20

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ""
  return value ?? ""
}

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await getCurrentUser()
  if (!user) {
    // Not a direct redirect("/login") — see app/(app)/layout.tsx.
    redirect("/api/auth/clear-session")
  }

  // Role gate: only OWNER/ADMIN may view the audit trail. Others get a denial
  // screen and the denial itself is recorded.
  if (user.role !== "OWNER" && user.role !== "ADMIN") {
    logger.warn("Acesso negado à auditoria", {
      context: "audit",
      metadata: { userId: user.id, role: user.role },
    })
    await createAuditLog({
      clinicId: user.clinicId,
      userId: user.id,
      action: AuditAction.ACCESS_DENIED,
      entity: "AuditLog",
      description: `Acesso negado à auditoria para ${user.name} (${user.role}).`,
    })

    return (
      <div className="flex flex-col gap-6">
        <PageHeader />
        <AccessDenied description="Apenas Owner e Admin podem visualizar a auditoria da clínica." />
      </div>
    )
  }

  const params = await searchParams
  const q = firstParam(params.q).trim()
  const actionFilter = firstParam(params.action)
  const entityFilter = firstParam(params.entity)
  const pageParam = Number.parseInt(firstParam(params.page), 10)
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1

  // Tenant isolation: every query is scoped to the logged-in user's clinicId.
  // A user can never see another clinic's audit logs.
  const where = {
    clinicId: user.clinicId,
    ...(actionFilter ? { action: actionFilter } : {}),
    ...(entityFilter ? { entity: entityFilter } : {}),
    ...(q ? { description: { contains: q, mode: "insensitive" as const } } : {}),
  }

  logger.info("Auditoria consultada", {
    context: "audit",
    metadata: { userId: user.id, page, q, actionFilter, entityFilter },
  })

  let rows: AuditLogRow[] = []
  let total = 0
  let actions: string[] = []
  let entities: string[] = []
  let loadFailed = false

  try {
    const [logs, count, distinctActions, distinctEntities] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          createdAt: true,
          action: true,
          entity: true,
          description: true,
          user: { select: { name: true } },
        },
      }),
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where: { clinicId: user.clinicId },
        distinct: ["action"],
        select: { action: true },
        orderBy: { action: "asc" },
      }),
      prisma.auditLog.findMany({
        where: { clinicId: user.clinicId },
        distinct: ["entity"],
        select: { entity: true },
        orderBy: { entity: "asc" },
      }),
    ])

    rows = logs.map((log) => ({
      id: log.id,
      createdAt: log.createdAt,
      action: log.action,
      entity: log.entity,
      description: log.description,
      userName: log.user?.name ?? null,
    }))
    total = count
    actions = distinctActions.map((a) => a.action)
    entities = distinctEntities.map((e) => e.entity)
  } catch (error) {
    loadFailed = true
    logger.error("Falha ao carregar registros de auditoria", {
      context: "audit",
      error,
      metadata: { userId: user.id, clinicId: user.clinicId },
    })
  }

  // Record that the audit log was opened — but only the "fresh open" (page 1,
  // no filters), so paginating/filtering doesn't flood the trail with views.
  if (!loadFailed && page === 1 && !q && !actionFilter && !entityFilter) {
    await createAuditLog({
      clinicId: user.clinicId,
      userId: user.id,
      action: AuditAction.AUDIT_LOG_VIEWED,
      entity: "AuditLog",
      description: `${user.name} abriu a auditoria da clínica.`,
    })
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function pageHref(targetPage: number): string {
    const sp = new URLSearchParams()
    if (q) sp.set("q", q)
    if (actionFilter) sp.set("action", actionFilter)
    if (entityFilter) sp.set("entity", entityFilter)
    if (targetPage > 1) sp.set("page", String(targetPage))
    return `/auditoria${sp.toString() ? `?${sp.toString()}` : ""}`
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader />

      {loadFailed ? (
        <ErrorState description="Não foi possível carregar os registros de auditoria. Verifique a conexão com o banco e tente novamente." />
      ) : (
        <>
          <AuditLogFilters
            actions={actions}
            entities={entities}
            defaults={{ q, action: actionFilter, entity: entityFilter }}
          />

          <AuditLogTable logs={rows} />

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {total} {total === 1 ? "registro" : "registros"} · página {page} de {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                nativeButton={false}
                render={
                  page <= 1 ? (
                    <span>Anterior</span>
                  ) : (
                    <Link href={pageHref(page - 1)}>Anterior</Link>
                  )
                }
              />
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                nativeButton={false}
                render={
                  page >= totalPages ? (
                    <span>Próxima</span>
                  ) : (
                    <Link href={pageHref(page + 1)}>Próxima</Link>
                  )
                }
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function PageHeader() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <ScrollText className="size-5.5" />
      </div>
      <div>
        <h2 className="text-xl font-semibold text-foreground">Auditoria</h2>
        <p className="text-sm text-muted-foreground">
          Histórico de eventos e ações registradas na sua clínica.
        </p>
      </div>
    </div>
  )
}
