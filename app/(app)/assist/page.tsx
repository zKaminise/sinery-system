import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Sparkles, TriangleAlert } from "lucide-react"

import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { getCurrentUser } from "@/lib/current-user"
import { canUseAssistSimulator, canEditAiSettings, canManageKnowledgeBase } from "@/lib/permissions"
import { getClinicTimeZone } from "@/lib/appointments/date-utils"
import {
  getAssistSimulations,
  getAssistSimulationDetail,
  getAssistSummary,
  getAiSettings,
  getKnowledgeBase,
  getAssistPatients,
  getAssistRuntimeInfo,
  type AssistSimulationDetail,
  type AssistSimulationListItem,
  type AssistSummary,
  type AssistRuntimeInfo,
  type AiSettingsData,
  type KnowledgeItem,
} from "@/lib/assist/queries"
import { ErrorState } from "@/components/common/error-state"
import { AssistSummaryCards } from "@/components/assist/assist-summary-cards"
import { AssistModeBanner } from "@/components/assist/assist-mode-banner"
import { AssistPageClient } from "@/components/assist/assist-page-client"
import { AiSettingsCard } from "@/components/assist/ai-settings-card"
import { KnowledgeBaseManager } from "@/components/assist/knowledge-base-manager"

export const metadata: Metadata = {
  title: "Sinery Assist — Sinery System",
}

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ""
  return value ?? ""
}

export default async function AssistPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/api/auth/clear-session")
  }

  const params = await searchParams
  const selectedId = firstParam(params.c)

  const settings = await prisma.clinicSettings.findUnique({
    where: { clinicId: user.clinicId },
    select: { timezone: true },
  })
  const timeZone = getClinicTimeZone(settings?.timezone)

  let simulations: AssistSimulationListItem[] = []
  let summary: AssistSummary = { simulations: 0, aiScheduled: 0, transferredToHuman: 0, aiCallsToday: 0, aiTokensToday: 0 }
  let runtime: AssistRuntimeInfo | null = null
  let aiSettings: AiSettingsData | null = null
  let knowledge: KnowledgeItem[] = []
  let patients: { id: string; name: string }[] = []
  let selected: AssistSimulationDetail | null = null
  let loadFailed = false

  try {
    ;[simulations, summary, runtime, aiSettings, knowledge, patients] = await Promise.all([
      getAssistSimulations(user.clinicId),
      getAssistSummary(user.clinicId),
      getAssistRuntimeInfo(user.clinicId),
      getAiSettings(user.clinicId),
      getKnowledgeBase(user.clinicId),
      getAssistPatients(user.clinicId),
    ])
    if (selectedId) {
      selected = await getAssistSimulationDetail(user.clinicId, selectedId)
    }
  } catch (error) {
    loadFailed = true
    logger.error("Falha ao carregar a Sinery Assist", {
      context: "assist",
      error,
      metadata: { clinicId: user.clinicId },
    })
  }

  const canUse = canUseAssistSimulator(user.role)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-secondary/15 text-secondary">
          <Sparkles className="size-5.5" />
        </div>
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Sinery Assist</h2>
          <p className="text-sm text-muted-foreground">
            Teste fluxos de atendimento inteligente antes da integração com IA real e WhatsApp.
          </p>
        </div>
      </div>

      {runtime && (
        <AssistModeBanner runtime={runtime} aiCallsToday={summary.aiCallsToday} aiTokensToday={summary.aiTokensToday} />
      )}

      <div className="flex items-start gap-2 rounded-xl border border-warning/20 bg-warning/5 px-4 py-3 text-sm text-foreground">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
        <span>Ambiente interno de testes. WhatsApp real ainda não está integrado.</span>
      </div>

      {loadFailed || !aiSettings ? (
        <ErrorState description="Não foi possível carregar a Sinery Assist. Verifique a conexão com o banco e tente novamente." />
      ) : (
        <>
          <AssistSummaryCards summary={summary} />

          <AssistPageClient
            items={simulations}
            selected={selected}
            timeZone={timeZone}
            patients={patients}
            canUse={canUse}
          />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <AiSettingsCard settings={aiSettings} canEdit={canEditAiSettings(user.role)} />
            <KnowledgeBaseManager items={knowledge} canManage={canManageKnowledgeBase(user.role)} />
          </div>
        </>
      )}
    </div>
  )
}
