import "server-only"

import { prisma } from "@/lib/prisma"
import { decideSendProvider } from "@/lib/messaging/messaging-router"
import { getMessagingAppEnv } from "@/lib/messaging/messaging-config"
import { normalizeMessagingProvider, type MessagingProvider } from "@/lib/messaging/messaging-types"
import { getEvolutionFlags } from "@/lib/evolution/evolution-config"
import { sendWhatsAppTextMessage } from "@/lib/whatsapp/whatsapp-send-service"
import { sendEvolutionTextForConversation } from "@/lib/evolution/evolution-send-service"

export interface ConversationSendInput {
  clinicId: string
  conversationId: string
  text: string
  sentByUserId: string
  sentByUserName: string
}

export type ConversationSendResult =
  | { ok: true; messageId: string; deliveryStatus: string; mock: boolean }
  | { ok: false; code: string; httpStatus: number; message: string }

/** Resolves the messaging provider configured for a clinic (default Meta). */
export async function resolveConversationProvider(clinicId: string): Promise<MessagingProvider> {
  const integration = await prisma.whatsAppIntegration.findUnique({ where: { clinicId }, select: { provider: true } })
  return normalizeMessagingProvider(integration?.provider)
}

/**
 * Sends a human text on a WHATSAPP-channel conversation, routing to the clinic's
 * configured provider (Meta Cloud API or Evolution API). Evolution is blocked in
 * production unless explicitly allowed. The provider is decided in the backend
 * from the clinic's integration — NEVER from the frontend.
 */
export async function sendConversationText(input: ConversationSendInput): Promise<ConversationSendResult> {
  const integration = await prisma.whatsAppIntegration.findUnique({ where: { clinicId: input.clinicId }, select: { provider: true } })
  const decision = decideSendProvider({
    integrationProvider: integration?.provider,
    appEnv: getMessagingAppEnv(),
    evolutionAllowedInProduction: getEvolutionFlags().allowInProduction,
  })
  if (!decision.ok) {
    return { ok: false, code: "provider_blocked", httpStatus: 409, message: "Envio bloqueado: a Evolution API não é permitida em produção. Use a API oficial da Meta." }
  }

  if (decision.provider === "EVOLUTION_API") {
    return sendEvolutionTextForConversation(input)
  }
  return sendWhatsAppTextMessage(input)
}
