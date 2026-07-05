import type { AuditActionValue } from "@/lib/audit-actions"
import type { ConversationStatus, MessageSenderType } from "@/lib/generated/prisma/client"

/** Intents the deterministic (rules-based) classifier can recognize. */
export type AssistIntent =
  | "SCHEDULE_APPOINTMENT"
  | "RESCHEDULE_APPOINTMENT"
  | "CANCEL_APPOINTMENT"
  | "CONFIRM_APPOINTMENT"
  | "ASK_SERVICES"
  | "ASK_ADDRESS"
  | "ASK_HOURS"
  | "ASK_PRICE"
  | "HUMAN_HELP"
  | "EMERGENCY_OR_SENSITIVE"
  | "UNKNOWN"

/** Steps a multi-turn flow can be waiting on (stored in conversation metadata). */
export type AssistFlowStep =
  | "IDLE"
  | "WAITING_SERVICE"
  | "WAITING_DATE"
  | "WAITING_SLOT_SELECTION"
  | "WAITING_APPOINTMENT_SELECTION"
  | "CONFIRM_CANCEL"
  | "WAITING_NEW_DATE"
  | "COMPLETED"
  | "TRANSFERRED_TO_HUMAN"

/** A concrete bookable slot suggested to the patient (clinic-local wall clock). */
export interface AssistSlot {
  index: number
  professionalId: string
  professionalName: string
  serviceId: string
  serviceName: string
  date: string
  startTime: string
  endTime: string
}

/** An appointment offered for selection in cancel/reschedule flows. */
export interface AssistAppointmentOption {
  index: number
  appointmentId: string
  serviceId: string | null
  serviceName: string | null
  professionalName: string
  date: string
  startTime: string
}

/**
 * Persisted between turns in `Conversation.metadata.assistFlow`. Deterministic
 * replacement for the "session memory" a real LLM would keep.
 */
export interface AssistFlowState {
  intent: AssistIntent
  step: AssistFlowStep
  detectedServiceId?: string
  detectedServiceName?: string
  detectedDate?: string
  detectedPeriod?: "MORNING" | "AFTERNOON" | "EVENING" | "ANY"
  suggestedSlots?: AssistSlot[]
  appointmentOptions?: AssistAppointmentOption[]
  selectedAppointmentId?: string
}

/**
 * Lightweight per-turn AI metadata persisted in `Conversation.metadata.aiMeta`
 * and surfaced in the /assist context panel (mode/intent/confidence/tool).
 */
export interface AiTurnMeta {
  mode: "RULE_BASED" | "OPENAI"
  intent?: AssistIntent
  confidence?: number
  lastTool?: string
  fallbackReason?: string
}

/** An outbound message the assistant wants to append to the thread. */
export interface AssistReplyMessage {
  senderType: Extract<MessageSenderType, "AI" | "SYSTEM">
  content: string
}

/** An audit event the turn wants recorded. */
export interface AssistAuditEntry {
  action: AuditActionValue
  description: string
  metadata?: Record<string, unknown>
}

/**
 * The full result of the assistant processing one patient message. The API
 * route persists all of this (messages, status, metadata, audits) after the
 * inbound patient message has already been saved.
 */
export interface AssistTurn {
  replies: AssistReplyMessage[]
  /** New flow state to store; `null` clears it (flow finished/idle). */
  flow: AssistFlowState | null
  /** New conversation status, if it should change. */
  status?: ConversationStatus
  audits: AssistAuditEntry[]
}
