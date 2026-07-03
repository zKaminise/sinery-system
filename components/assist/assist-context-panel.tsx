import Link from "next/link"
import { UserRound, Activity, Workflow, Sparkles, Gauge, Wrench, TriangleAlert, Layers, ClipboardList, CalendarClock } from "lucide-react"

import { ConversationStatusBadge } from "@/components/conversations/conversation-status-badge"
import { intentLabels } from "@/components/assist/intent-badge"
import type { AssistSimulationDetail } from "@/lib/assist/queries"

const flowLabels: Record<string, string> = {
  IDLE: "Nenhum fluxo ativo",
  SCHEDULING: "Agendamento",
  RESCHEDULING: "Remarcação",
  CANCELLING: "Cancelamento",
  CONFIRMING: "Confirmação",
  TRANSFERRED_TO_HUMAN: "Transferido para humano",
  COMPLETED: "Concluído",
}

const stepLabels: Record<string, string> = {
  WAITING_SERVICE: "Aguardando serviço",
  WAITING_DATE: "Aguardando data",
  WAITING_SLOT_SELECTION: "Aguardando escolha de horário",
  WAITING_APPOINTMENT_SELECTION: "Aguardando escolha da consulta",
  WAITING_CONFIRMATION: "Aguardando confirmação",
  COMPLETED: "Concluído",
}

const modeLabels: Record<string, string> = {
  RULE_BASED: "Simulador",
  OPENAI: "IA real",
  MOCK: "IA real (mock)",
}

const fallbackReasonLabels: Record<string, string> = {
  sensitive_message: "Mensagem sensível",
  low_confidence: "Baixa confiança",
  model_transfer: "IA solicitou humano",
  tool_transfer: "Ferramenta transferiu",
  invalid_output: "Saída inválida da IA",
  provider_error: "Falha no provedor de IA",
  daily_token_limit: "Limite diário de tokens",
  no_api_key: "Sem chave de API",
  real_ai_disabled: "IA real desativada",
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
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </span>
      {children}
    </div>
  )
}

export function AssistContextPanel({ simulation }: { simulation: AssistSimulationDetail }) {
  const s = simulation.assist
  const fallbackReason = simulation.aiMeta?.fallbackReason

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Estado da conversa</h3>
        <p className="text-xs text-muted-foreground">O que a Sinery Assist entendeu e está fazendo.</p>
      </div>

      <div className="flex flex-col gap-3 text-sm">
        <Row icon={Activity} label="Status">
          <ConversationStatusBadge status={simulation.status} />
        </Row>
        <Row icon={Sparkles} label="Modo">
          <span className="text-xs font-medium text-foreground">{modeLabels[s.mode] ?? s.mode}</span>
        </Row>
        <Row icon={Workflow} label="Intenção">
          <span className="text-xs font-medium text-foreground">
            {s.currentIntent ? intentLabels[s.currentIntent] : "—"}
          </span>
        </Row>
        <Row icon={Layers} label="Fluxo">
          <span className="text-xs font-medium text-foreground">{flowLabels[s.flow] ?? s.flow}</span>
        </Row>
        <Row icon={ClipboardList} label="Etapa">
          <span className="text-xs font-medium text-foreground">{s.step ? stepLabels[s.step] ?? s.step : "—"}</span>
        </Row>
        {s.detectedServiceName && (
          <Row icon={ClipboardList} label="Serviço">
            <span className="text-xs font-medium text-foreground">{s.detectedServiceName}</span>
          </Row>
        )}
        {s.detectedDate && (
          <Row icon={CalendarClock} label="Data">
            <span className="text-xs font-medium text-foreground">
              {s.detectedDate.split("-").reverse().join("/")}
            </span>
          </Row>
        )}
        <Row icon={Layers} label="Horários sugeridos">
          <span className="text-xs font-medium text-foreground">{s.suggestedSlots.length}</span>
        </Row>
        {s.lastConfidence != null && s.mode !== "RULE_BASED" && (
          <Row icon={Gauge} label="Confiança">
            <span className="text-xs font-medium text-foreground">{Math.round(s.lastConfidence * 100)}%</span>
          </Row>
        )}
        {s.lastToolName && (
          <Row icon={Wrench} label="Última ferramenta">
            <span className="text-xs font-medium text-foreground">{s.lastToolName}</span>
          </Row>
        )}
        {fallbackReason && (
          <Row icon={TriangleAlert} label="Fallback">
            <span className="text-xs font-medium text-warning">
              {fallbackReasonLabels[fallbackReason] ?? fallbackReason}
            </span>
          </Row>
        )}
        <Row icon={UserRound} label="Paciente">
          {simulation.patientId ? (
            <Link
              href={`/pacientes/${simulation.patientId}`}
              className="truncate text-xs font-medium text-foreground hover:underline"
            >
              {simulation.patientName}
            </Link>
          ) : (
            <span className="text-xs text-muted-foreground">Não vinculado</span>
          )}
        </Row>
      </div>

      {s.suggestedSlots.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Horários sugeridos</span>
          <ul className="flex flex-col gap-1.5">
            {s.suggestedSlots.map((slot) => (
              <li key={slot.option} className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary/15 text-[11px] font-semibold text-secondary">
                  {slot.option}
                </span>
                <span className="font-medium text-foreground">{slot.displayTime}</span>
                <span className="truncate text-muted-foreground">· {slot.professionalName}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="rounded-lg bg-secondary/5 px-3 py-2 text-xs text-muted-foreground ring-1 ring-secondary/15">
        {s.mode === "RULE_BASED"
          ? "Simulador determinístico: respostas por regras fixas. Consultas usam as mesmas validações da agenda."
          : "IA real com ferramentas controladas: agendamentos passam pelas validações da agenda e nunca dão diagnóstico ou indicam remédios."}
      </p>
    </div>
  )
}
