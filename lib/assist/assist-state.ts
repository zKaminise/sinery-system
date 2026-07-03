import type { AssistFlowState, AssistIntent, AiTurnMeta, AssistSlot } from "@/lib/assist/types"

export type AssistFlowName =
  | "IDLE"
  | "SCHEDULING"
  | "RESCHEDULING"
  | "CANCELLING"
  | "CONFIRMING"
  | "TRANSFERRED_TO_HUMAN"
  | "COMPLETED"

export type AssistDisplayStep =
  | "WAITING_SERVICE"
  | "WAITING_DATE"
  | "WAITING_SLOT_SELECTION"
  | "WAITING_APPOINTMENT_SELECTION"
  | "WAITING_CONFIRMATION"
  | "COMPLETED"
  | null

export interface AssistDisplaySlot {
  option: number
  professionalId: string
  professionalName: string
  serviceId: string
  serviceName: string
  date: string
  startTime: string
  endTime: string
  displayDate: string
  displayTime: string
}

/**
 * Denormalized, standardized assistant state stored in
 * `Conversation.metadata.assist`. It is a VIEW derived from the internal flow
 * state + last AI meta — safe to expose to the UI and easy to reason about.
 */
export interface AssistState {
  mode: "RULE_BASED" | "OPENAI" | "MOCK"
  currentIntent: AssistIntent | null
  flow: AssistFlowName
  step: AssistDisplayStep
  patientId: string | null
  detectedServiceId: string | null
  detectedServiceName: string | null
  detectedDate: string | null
  selectedAppointmentId: string | null
  suggestedSlots: AssistDisplaySlot[]
  lastToolName: string | null
  lastConfidence: number | null
  lastUpdatedAt: string
}

const INTENT_TO_FLOW: Partial<Record<AssistIntent, AssistFlowName>> = {
  SCHEDULE_APPOINTMENT: "SCHEDULING",
  RESCHEDULE_APPOINTMENT: "RESCHEDULING",
  CANCEL_APPOINTMENT: "CANCELLING",
  CONFIRM_APPOINTMENT: "CONFIRMING",
}

function displayStep(step: AssistFlowState["step"]): AssistDisplayStep {
  switch (step) {
    case "WAITING_SERVICE":
      return "WAITING_SERVICE"
    case "WAITING_DATE":
    case "WAITING_NEW_DATE":
      return "WAITING_DATE"
    case "WAITING_SLOT_SELECTION":
      return "WAITING_SLOT_SELECTION"
    case "WAITING_APPOINTMENT_SELECTION":
      return "WAITING_APPOINTMENT_SELECTION"
    case "CONFIRM_CANCEL":
      return "WAITING_CONFIRMATION"
    case "COMPLETED":
      return "COMPLETED"
    default:
      return null
  }
}

function dateLabel(dateStr: string): string {
  const [, m, d] = dateStr.split("-")
  return d && m ? `${d}/${m}` : dateStr
}

function toDisplaySlot(slot: AssistSlot): AssistDisplaySlot {
  return {
    option: slot.index,
    professionalId: slot.professionalId,
    professionalName: slot.professionalName,
    serviceId: slot.serviceId,
    serviceName: slot.serviceName,
    date: slot.date,
    startTime: slot.startTime,
    endTime: slot.endTime,
    displayDate: dateLabel(slot.date),
    displayTime: slot.startTime,
  }
}

/** Builds the standardized `assist` state view from internal flow + AI meta. */
export function deriveAssistState(
  flow: AssistFlowState | null,
  aiMeta: AiTurnMeta | null,
  patientId: string | null
): AssistState {
  const mode = aiMeta?.mode ?? "RULE_BASED"
  let flowName: AssistFlowName = "IDLE"
  if (flow) {
    if (flow.step === "TRANSFERRED_TO_HUMAN") flowName = "TRANSFERRED_TO_HUMAN"
    else if (flow.step === "COMPLETED") flowName = "COMPLETED"
    else flowName = INTENT_TO_FLOW[flow.intent] ?? "IDLE"
  }

  return {
    mode,
    currentIntent: aiMeta?.intent ?? flow?.intent ?? null,
    flow: flowName,
    step: flow ? displayStep(flow.step) : null,
    patientId,
    detectedServiceId: flow?.detectedServiceId ?? null,
    detectedServiceName: flow?.detectedServiceName ?? null,
    detectedDate: flow?.detectedDate ?? null,
    selectedAppointmentId: flow?.selectedAppointmentId ?? null,
    suggestedSlots: (flow?.suggestedSlots ?? []).map(toDisplaySlot),
    lastToolName: aiMeta?.lastTool ?? null,
    lastConfidence: aiMeta?.confidence ?? null,
    lastUpdatedAt: new Date().toISOString(),
  }
}

type ConvMetadata = {
  assist?: AssistState
  assistFlow?: AssistFlowState
  aiMeta?: AiTurnMeta
} | null

/**
 * Reads the standardized assist state from a conversation's metadata.
 * Backward-compatible: if only the legacy `assistFlow`/`aiMeta` are present
 * (or nothing at all), it reconstructs/returns a sensible default so old
 * conversations never break.
 */
export function getAssistState(metadata: unknown, patientId: string | null = null): AssistState {
  const meta = (metadata ?? null) as ConvMetadata
  if (meta?.assist) return meta.assist
  return deriveAssistState(meta?.assistFlow ?? null, meta?.aiMeta ?? null, patientId)
}

/** Returns the suggested slot for a given menu option (1-based), or null. */
export function getSuggestedSlotByOption(state: AssistState, option: number): AssistDisplaySlot | null {
  return state.suggestedSlots.find((s) => s.option === option) ?? null
}
