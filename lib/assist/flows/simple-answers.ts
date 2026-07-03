import "server-only"

import { AuditAction } from "@/lib/audit-actions"
import { aiReply, transferToHuman, type AssistContext } from "@/lib/assist/context"
import { extractService } from "@/lib/assist/intent-detector"
import type { AssistTurn } from "@/lib/assist/types"

const IDLE_DONE: AssistTurn["flow"] = null

export function handleAskAddress(ctx: AssistContext): AssistTurn {
  const { address, city, state, name } = ctx.clinic
  if (!address && !city) {
    return transferToHuman(
      ctx,
      "Ainda não encontrei o endereço cadastrado. Vou chamar alguém da equipe para te ajudar.",
      "endereco_nao_cadastrado"
    )
  }
  const parts = [address, [city, state].filter(Boolean).join(" - ")].filter(Boolean)
  return {
    replies: [aiReply(`A ${name} fica em: ${parts.join(", ")}. Posso ajudar com mais alguma coisa?`)],
    flow: IDLE_DONE,
    audits: [],
  }
}

export function handleAskHours(ctx: AssistContext): AssistTurn {
  const { businessStartHour, businessEndHour } = ctx.settings
  if (businessStartHour == null || businessEndHour == null) {
    return {
      replies: [
        aiReply(
          "Para confirmar nossos horários de funcionamento, vou verificar com a equipe. Posso ajudar com mais alguma coisa?"
        ),
      ],
      flow: IDLE_DONE,
      audits: [],
    }
  }
  const fmt = (h: number) => `${String(h).padStart(2, "0")}:00`
  return {
    replies: [
      aiReply(
        `Nosso horário de atendimento é das ${fmt(businessStartHour)} às ${fmt(businessEndHour)}, de segunda a sexta. Posso ajudar com mais alguma coisa?`
      ),
    ],
    flow: IDLE_DONE,
    audits: [],
  }
}

export function handleAskPrice(ctx: AssistContext): AssistTurn {
  // Gated by AiSettings.canAnswerPricing.
  if (!ctx.aiSettings.canAnswerPricing) {
    return transferToHuman(
      ctx,
      "Para valores, vou chamar alguém da equipe para te passar a informação correta.",
      "pricing_disabled"
    )
  }

  const service = extractService(ctx.text, ctx.services)
  if (!service) {
    const names = ctx.services.map((s) => s.name).join(", ")
    return {
      replies: [
        aiReply(`Sobre qual serviço você gostaria de saber o valor? Temos: ${names}.`),
      ],
      flow: IDLE_DONE,
      audits: [],
    }
  }

  const full = ctx.services.find((s) => s.id === service.id)
  if (!full?.priceInCents) {
    return transferToHuman(
      ctx,
      `Ainda não tenho o valor de ${service.name} cadastrado. Vou chamar alguém da equipe para te informar.`,
      "price_not_registered"
    )
  }

  const price = (full.priceInCents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
  return {
    replies: [
      aiReply(
        `O valor estimado de ${service.name} é ${price}. A confirmação final depende da avaliação da clínica. Posso ajudar com mais alguma coisa?`
      ),
    ],
    flow: IDLE_DONE,
    audits: [],
  }
}

export function handleHumanHelp(ctx: AssistContext): AssistTurn {
  return transferToHuman(
    ctx,
    "Claro! Vou chamar alguém da equipe para continuar o seu atendimento por aqui.",
    "human_requested"
  )
}

export function handleEmergency(ctx: AssistContext): AssistTurn {
  // Safety-critical: never diagnose or suggest medication — always escalate.
  return {
    replies: [
      aiReply(
        "Sinto muito por isso. Para sua segurança, vou chamar alguém da equipe para te orientar corretamente. Se for uma emergência, procure atendimento imediatamente."
      ),
      {
        senderType: "SYSTEM",
        content: "Mensagem sensível detectada. Conversa transferida para atendimento humano.",
      },
    ],
    flow: ctx.flow
      ? { ...ctx.flow, step: "TRANSFERRED_TO_HUMAN" }
      : { intent: "EMERGENCY_OR_SENSITIVE", step: "TRANSFERRED_TO_HUMAN" },
    status: "WAITING_HUMAN",
    audits: [
      {
        action: AuditAction.ASSIST_TRANSFERRED_TO_HUMAN,
        description: "Mensagem sensível/emergência — transferida para humano sem diagnóstico.",
        metadata: { conversationId: ctx.conversationId, reason: "emergency_or_sensitive" },
      },
    ],
  }
}

export function handleUnknown(ctx: AssistContext): AssistTurn {
  const fallback =
    ctx.aiSettings.humanFallbackMessage ??
    "Não quero te passar uma informação errada. Vou chamar alguém da equipe para te ajudar por aqui."
  return transferToHuman(ctx, fallback, "unknown_intent")
}
