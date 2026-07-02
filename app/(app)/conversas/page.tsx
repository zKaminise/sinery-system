import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { MessagesSquare } from "lucide-react"

import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { getCurrentUser } from "@/lib/current-user"
import { canManageConversations, canAssignConversationToOthers } from "@/lib/permissions"
import { getClinicTimeZone } from "@/lib/appointments/date-utils"
import {
  getConversationsList,
  getConversationDetail,
  getConversationSummary,
  getConversationFormOptions,
  type ConversationDetail,
  type ConversationsListResult,
  type ConversationSummary,
  type ConversationFormOptions,
} from "@/lib/conversations/queries"
import { ErrorState } from "@/components/common/error-state"
import { ConversationSummaryCards } from "@/components/conversations/conversation-summary-cards"
import { ConversationsPageClient } from "@/components/conversations/conversations-page-client"
import type { ConversationStatus, ConversationChannel } from "@/lib/generated/prisma/client"

export const metadata: Metadata = {
  title: "Conversas — Sinery System",
}

const STATUS_VALUES: ConversationStatus[] = ["AI_HANDLING", "WAITING_HUMAN", "HUMAN_HANDLING", "CLOSED"]
const CHANNEL_VALUES: ConversationChannel[] = ["WHATSAPP", "INTERNAL_SIMULATOR"]

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ""
  return value ?? ""
}

export default async function ConversasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/api/auth/clear-session")
  }

  const params = await searchParams
  const q = firstParam(params.q).trim()
  const rawStatus = firstParam(params.status)
  const rawChannel = firstParam(params.channel)
  const assignedUserId = firstParam(params.assignedUserId)
  const selectedId = firstParam(params.c)
  const status = STATUS_VALUES.includes(rawStatus as ConversationStatus)
    ? (rawStatus as ConversationStatus)
    : undefined
  const channel = CHANNEL_VALUES.includes(rawChannel as ConversationChannel)
    ? (rawChannel as ConversationChannel)
    : undefined
  const pageParam = Number.parseInt(firstParam(params.page), 10)
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1

  const settings = await prisma.clinicSettings.findUnique({
    where: { clinicId: user.clinicId },
    select: { timezone: true },
  })
  const timeZone = getClinicTimeZone(settings?.timezone)

  let list: ConversationsListResult = { items: [], total: 0, page, totalPages: 1 }
  let summary: ConversationSummary = {
    open: 0,
    waitingHuman: 0,
    humanHandling: 0,
    aiHandling: 0,
    closedThisWeek: 0,
  }
  let formOptions: ConversationFormOptions = { patients: [], assignableUsers: [] }
  let selected: ConversationDetail | null = null
  let loadFailed = false

  try {
    ;[list, summary, formOptions] = await Promise.all([
      getConversationsList(user.clinicId, { q, status, channel, assignedUserId, page }),
      getConversationSummary(user.clinicId),
      getConversationFormOptions(user.clinicId),
    ])

    // Selected conversation (tenant-scoped). An id from another clinic simply
    // resolves to null — the thread pane shows the empty state, never leaking
    // that the conversation exists elsewhere.
    if (selectedId) {
      selected = await getConversationDetail(user.clinicId, selectedId)
    }
  } catch (error) {
    loadFailed = true
    logger.error("Falha ao carregar conversas", {
      context: "conversations",
      error,
      metadata: { clinicId: user.clinicId },
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <MessagesSquare className="size-5.5" />
        </div>
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Conversas</h2>
          <p className="text-sm text-muted-foreground">
            Acompanhe atendimentos, mensagens e solicitações dos pacientes.
          </p>
        </div>
      </div>

      {loadFailed ? (
        <ErrorState description="Não foi possível carregar as conversas. Verifique a conexão com o banco e tente novamente." />
      ) : (
        <>
          <ConversationSummaryCards summary={summary} />

          <ConversationsPageClient
            items={list.items}
            selected={selected}
            filters={{
              q,
              status: status ?? "",
              channel: channel ?? "",
              assignedUserId: assignedUserId ?? "",
            }}
            page={list.page}
            totalPages={list.totalPages}
            timeZone={timeZone}
            formOptions={formOptions}
            canManage={canManageConversations(user.role)}
            canAssignOthers={canAssignConversationToOthers(user.role)}
          />
        </>
      )}
    </div>
  )
}
