import type { AiToolName } from "@/lib/ai/assist-schemas"

export interface ToolMeta {
  /** Whether the tool changes data (→ must audit + is permission-gated). */
  mutates: boolean
  /** AiSettings capability required, if any. */
  requiresCapability?: "canSchedule" | "canReschedule" | "canCancel" | "canAnswerPricing"
  /** Whether the tool needs the conversation to have a linked patient. */
  requiresPatient: boolean
}

/**
 * Registry of the tools the AI may request. The executor consults this to
 * enforce the allow-list, AiSettings capability gating, and patient
 * requirements before running anything.
 */
export const ASSIST_TOOLS: Record<AiToolName, ToolMeta> = {
  getClinicInfo: { mutates: false, requiresPatient: false },
  listActiveServices: { mutates: false, requiresPatient: false },
  findAvailableSlots: { mutates: false, requiresPatient: false },
  createAppointment: { mutates: true, requiresCapability: "canSchedule", requiresPatient: true },
  findPatientUpcomingAppointments: { mutates: false, requiresPatient: true },
  cancelAppointment: { mutates: true, requiresCapability: "canCancel", requiresPatient: true },
  confirmAppointment: { mutates: true, requiresPatient: true },
  rescheduleAppointment: { mutates: true, requiresCapability: "canReschedule", requiresPatient: true },
  transferToHuman: { mutates: false, requiresPatient: false },
  answerFromKnowledgeBase: { mutates: false, requiresPatient: false },
}

export function isKnownTool(name: string): name is AiToolName {
  return Object.prototype.hasOwnProperty.call(ASSIST_TOOLS, name)
}
