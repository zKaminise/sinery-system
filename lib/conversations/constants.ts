import { AuditAction, type AuditActionValue } from "@/lib/audit-actions"
import type {
  ConversationStatus,
  ConversationChannel,
  MessageSenderType,
} from "@/lib/generated/prisma/client"

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export const conversationStatusLabels: Record<ConversationStatus, string> = {
  AI_HANDLING: "Sinery Assist",
  WAITING_HUMAN: "Aguardando humano",
  HUMAN_HANDLING: "Em atendimento",
  CLOSED: "Encerrada",
}

export const conversationChannelLabels: Record<ConversationChannel, string> = {
  WHATSAPP: "WhatsApp",
  INTERNAL_SIMULATOR: "Teste interno",
}

export const messageSenderLabels: Record<MessageSenderType, string> = {
  PATIENT: "Paciente",
  AI: "Sinery Assist",
  HUMAN: "Atendente",
  SYSTEM: "Sistema",
}

export const conversationStatuses: ConversationStatus[] = [
  "AI_HANDLING",
  "WAITING_HUMAN",
  "HUMAN_HANDLING",
  "CLOSED",
]

export const conversationChannels: ConversationChannel[] = [
  "WHATSAPP",
  "INTERNAL_SIMULATOR",
]

// ---------------------------------------------------------------------------
// Conversation state machine (V1)
// ---------------------------------------------------------------------------
//
// Allowed transitions (see docs/conversations.md):
//   AI_HANDLING    -> WAITING_HUMAN, HUMAN_HANDLING, CLOSED
//   WAITING_HUMAN  -> HUMAN_HANDLING, CLOSED
//   HUMAN_HANDLING -> AI_HANDLING, WAITING_HUMAN, CLOSED
//   CLOSED         -> WAITING_HUMAN, HUMAN_HANDLING

export const ALLOWED_STATUS_TRANSITIONS: Record<ConversationStatus, ConversationStatus[]> = {
  AI_HANDLING: ["WAITING_HUMAN", "HUMAN_HANDLING", "CLOSED"],
  WAITING_HUMAN: ["HUMAN_HANDLING", "CLOSED"],
  HUMAN_HANDLING: ["AI_HANDLING", "WAITING_HUMAN", "CLOSED"],
  CLOSED: ["WAITING_HUMAN", "HUMAN_HANDLING"],
}

export function canTransitionConversation(
  from: ConversationStatus,
  to: ConversationStatus
): boolean {
  if (from === to) return false
  return ALLOWED_STATUS_TRANSITIONS[from]?.includes(to) ?? false
}

/**
 * Whether `action` may run given the current status. This is intentionally
 * more permissive than `canTransitionConversation` for `take`/`assign`, which
 * can re-target a conversation that is already HUMAN_HANDLING (reassigning to
 * another attendant) — a same-status change that the raw transition table
 * rejects. All actions except `reopen` are blocked once CLOSED.
 */
export function canPerformConversationAction(
  action: ConversationAction,
  current: ConversationStatus
): boolean {
  switch (action) {
    case "take":
      return current !== "CLOSED"
    case "assign":
      return current !== "CLOSED"
    case "close":
      return current !== "CLOSED"
    case "transfer":
      return current === "AI_HANDLING" || current === "HUMAN_HANDLING"
    case "return_to_ai":
      return current === "WAITING_HUMAN" || current === "HUMAN_HANDLING"
    case "reopen":
      return current === "CLOSED"
    default:
      return false
  }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
//
// Every mutation the inbox exposes maps to one of these named actions. Each
// action resolves to a concrete target status plus the side effects (system
// message + audit action) it must produce, keeping the API handler declarative
// and the state machine centralized here.

export type ConversationAction =
  | "take"
  | "transfer"
  | "return_to_ai"
  | "close"
  | "reopen"
  | "assign"

export const conversationActions: ConversationAction[] = [
  "take",
  "transfer",
  "return_to_ai",
  "close",
  "reopen",
  "assign",
]

export interface ConversationActionResult {
  status: ConversationStatus
  /** `null` clears the assignee; `"self"` sets the acting user; `"input"` uses assignedUserId from the request. */
  assignee: "self" | "input" | null
  auditAction: AuditActionValue
  /** Builds the SYSTEM message content; `actorName` is the acting user's name. */
  systemMessage: (actorName: string) => string
}

export const CONVERSATION_ACTIONS: Record<ConversationAction, ConversationActionResult> = {
  take: {
    status: "HUMAN_HANDLING",
    assignee: "self",
    auditAction: AuditAction.CONVERSATION_TAKEN,
    systemMessage: (name) => `Atendimento assumido por ${name}.`,
  },
  transfer: {
    status: "WAITING_HUMAN",
    assignee: null,
    auditAction: AuditAction.CONVERSATION_TRANSFERRED_TO_HUMAN,
    systemMessage: () => "Conversa transferida para atendimento humano.",
  },
  return_to_ai: {
    status: "AI_HANDLING",
    assignee: null,
    auditAction: AuditAction.CONVERSATION_RETURNED_TO_AI,
    systemMessage: () =>
      "Conversa devolvida para Sinery Assist. A automação real será implementada nas próximas etapas.",
  },
  close: {
    status: "CLOSED",
    assignee: null,
    auditAction: AuditAction.CONVERSATION_CLOSED,
    systemMessage: () => "Conversa encerrada.",
  },
  reopen: {
    status: "WAITING_HUMAN",
    assignee: null,
    auditAction: AuditAction.CONVERSATION_REOPENED,
    systemMessage: () => "Conversa reaberta e aguardando atendimento humano.",
  },
  assign: {
    status: "HUMAN_HANDLING",
    assignee: "input",
    auditAction: AuditAction.CONVERSATION_ASSIGNED,
    systemMessage: (name) => `Atendimento atribuído a ${name}.`,
  },
}
