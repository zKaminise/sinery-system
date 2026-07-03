import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft, Gauge, TriangleAlert } from "lucide-react"

import { getCurrentUser } from "@/lib/current-user"
import { canViewAiUsage } from "@/lib/permissions"
import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"
import { logger } from "@/lib/logger"
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/common/error-state"
import { AiUsageSummaryCards } from "@/components/assist/ai-usage-summary-cards"
import { AiUsageTable } from "@/components/assist/ai-usage-table"
import { getAiUsageSummary, getAiUsageLogs, type AiUsageFilters } from "@/lib/ai/assist-usage-queries"

export const metadata: Metadata = {
  title: "Uso da IA — Sinery Assist",
}

function firstParam(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value
  return v && v.length > 0 ? v : undefined
}

export default async function AssistUsagePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await getCurrentUser()
  if (!user) redirect("/api/auth/clear-session")

  // Server-enforced access control — RECEPTIONIST/PROFESSIONAL are blocked.
  if (!canViewAiUsage(user.role)) {
    await createAuditLog({
      clinicId: user.clinicId,
      userId: user.id,
      action: AuditAction.ACCESS_DENIED,
      entity: "AiUsageLog",
      description: "Tentativa de acesso ao painel de uso da IA sem permissão.",
      metadata: { role: user.role },
    }).catch(() => {})
    return (
      <div className="flex flex-col gap-6">
        <h2 className="text-xl font-semibold text-foreground">Uso da IA</h2>
        <ErrorState
          title="Acesso negado"
          description="Apenas OWNER e ADMIN podem acessar o painel de uso e custos da Sinery Assist."
        />
      </div>
    )
  }

  const params = await searchParams
  const success = firstParam(params.success)
  const filters: AiUsageFilters = {
    dateFrom: firstParam(params.dateFrom),
    dateTo: firstParam(params.dateTo),
    provider: firstParam(params.provider),
    model: firstParam(params.model),
    success: success === "true" || success === "false" ? success : undefined,
    conversationId: firstParam(params.conversationId),
    errorCode: firstParam(params.errorCode),
    page: Number.parseInt(firstParam(params.page) ?? "1", 10) || 1,
  }

  let summary = null
  let logs = null
  let failed = false
  try {
    ;[summary, logs] = await Promise.all([
      getAiUsageSummary(user.clinicId),
      getAiUsageLogs(user.clinicId, filters),
    ])
    await createAuditLog({
      clinicId: user.clinicId,
      userId: user.id,
      action: AuditAction.ASSIST_USAGE_VIEWED,
      entity: "AiUsageLog",
      description: "Painel de uso da IA acessado.",
      metadata: {},
    })
  } catch (error) {
    failed = true
    logger.error("Falha ao carregar o painel de uso da IA", { context: "assist", error, metadata: { clinicId: user.clinicId } })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Gauge className="size-5.5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Uso da Sinery Assist</h2>
            <p className="text-sm text-muted-foreground">Métricas de uso, custo estimado e registros da IA.</p>
          </div>
        </div>
        <Button variant="outline" nativeButton={false} render={<Link href="/assist"><ArrowLeft className="size-4" /> Voltar</Link>} />
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-warning/20 bg-warning/5 px-4 py-3 text-sm text-foreground">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
        <span>Custo estimado. O valor real deve ser conferido no painel da OpenAI.</span>
      </div>

      {failed || !summary || !logs ? (
        <ErrorState description="Não foi possível carregar os dados de uso. Verifique a conexão com o banco e tente novamente." />
      ) : (
        <>
          <AiUsageSummaryCards summary={summary} />
          <AiUsageTable result={logs} filters={filters} />
        </>
      )}
    </div>
  )
}
