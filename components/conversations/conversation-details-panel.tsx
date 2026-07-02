"use client"

import Link from "next/link"
import { UserRound, Phone, Radio, Headset, CalendarClock, ExternalLink } from "lucide-react"

import { ConversationStatusBadge } from "@/components/conversations/conversation-status-badge"
import { conversationChannelLabels } from "@/lib/conversations/constants"
import { formatInboxDateTime } from "@/components/conversations/format"
import type { ConversationDetail } from "@/lib/conversations/queries"

interface ConversationDetailsPanelProps {
  conversation: ConversationDetail
  timeZone: string
}

export function ConversationDetailsPanel({ conversation, timeZone }: ConversationDetailsPanelProps) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Detalhes do contato</h3>
        <p className="text-xs text-muted-foreground">Informações da conversa selecionada.</p>
      </div>

      <dl className="flex flex-col gap-3 text-sm">
        <Row icon={UserRound} label="Contato">
          {conversation.patientId ? (
            <Link
              href={`/pacientes/${conversation.patientId}`}
              className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
            >
              {conversation.displayName}
              <ExternalLink className="size-3" />
            </Link>
          ) : (
            <span className="font-medium text-foreground">{conversation.displayName}</span>
          )}
        </Row>

        <Row icon={Phone} label="Telefone">
          <span className="text-foreground">{conversation.phone ?? "Não informado"}</span>
        </Row>

        <Row icon={Radio} label="Canal">
          <span className="text-foreground">{conversationChannelLabels[conversation.channel]}</span>
        </Row>

        <Row icon={Headset} label="Responsável">
          <span className="text-foreground">
            {conversation.assignedUserName ?? "Sem responsável"}
          </span>
        </Row>

        <Row icon={CalendarClock} label="Criada em">
          <span className="text-foreground">
            {formatInboxDateTime(conversation.createdAt, timeZone)}
          </span>
        </Row>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Status</span>
          <ConversationStatusBadge status={conversation.status} />
        </div>
      </dl>

      {conversation.patientId ? (
        <Link
          href={`/pacientes/${conversation.patientId}`}
          className="rounded-lg border border-border px-3 py-2 text-center text-xs font-medium text-foreground transition-colors hover:bg-muted/50"
        >
          Ver ficha do paciente
        </Link>
      ) : (
        <p className="rounded-lg border border-dashed border-border px-3 py-2 text-center text-xs text-muted-foreground">
          Contato não vinculado a um paciente.
        </p>
      )}

      <p className="rounded-lg bg-secondary/5 px-3 py-2 text-xs text-muted-foreground ring-1 ring-secondary/15">
        A Sinery Assist ainda está em preparação. O status &quot;Sinery Assist&quot; apenas simula o
        fluxo futuro de atendimento com IA.
      </p>
    </div>
  )
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </dt>
      <dd className="min-w-0 truncate text-right">{children}</dd>
    </div>
  )
}
