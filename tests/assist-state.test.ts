import { describe, it, expect } from "vitest"

import { deriveAssistState, getAssistState, getSuggestedSlotByOption } from "@/lib/assist/assist-state"
import type { AssistFlowState } from "@/lib/assist/types"

const flowWithSlots: AssistFlowState = {
  intent: "SCHEDULE_APPOINTMENT",
  step: "WAITING_SLOT_SELECTION",
  detectedServiceId: "s2",
  detectedServiceName: "Limpeza",
  detectedDate: "2026-07-10",
  suggestedSlots: [
    { index: 1, professionalId: "p1", professionalName: "Dr. Felipe", serviceId: "s2", serviceName: "Limpeza", date: "2026-07-10", startTime: "14:00", endTime: "15:00" },
    { index: 2, professionalId: "p1", professionalName: "Dr. Felipe", serviceId: "s2", serviceName: "Limpeza", date: "2026-07-10", startTime: "15:00", endTime: "16:00" },
  ],
}

describe("assist-state", () => {
  it("derives a standardized state from an internal flow", () => {
    const state = deriveAssistState(flowWithSlots, { mode: "OPENAI", intent: "SCHEDULE_APPOINTMENT", confidence: 0.9 }, "pat1")
    expect(state.flow).toBe("SCHEDULING")
    expect(state.step).toBe("WAITING_SLOT_SELECTION")
    expect(state.mode).toBe("OPENAI")
    expect(state.detectedServiceName).toBe("Limpeza")
    expect(state.suggestedSlots).toHaveLength(2)
    expect(state.suggestedSlots[0].option).toBe(1)
    expect(state.suggestedSlots[0].displayDate).toBe("10/07")
  })

  it("getSuggestedSlotByOption returns the right slot", () => {
    const state = deriveAssistState(flowWithSlots, null, null)
    expect(getSuggestedSlotByOption(state, 2)?.startTime).toBe("15:00")
  })

  it("getSuggestedSlotByOption returns null for an invalid option", () => {
    const state = deriveAssistState(flowWithSlots, null, null)
    expect(getSuggestedSlotByOption(state, 9)).toBeNull()
  })

  it("getAssistState is backward-compatible with legacy metadata (assistFlow)", () => {
    const state = getAssistState({ assistFlow: flowWithSlots, aiMeta: { mode: "RULE_BASED" } }, "pat1")
    expect(state.flow).toBe("SCHEDULING")
    expect(state.suggestedSlots).toHaveLength(2)
  })

  it("getAssistState returns an IDLE default for empty metadata", () => {
    const state = getAssistState(null)
    expect(state.flow).toBe("IDLE")
    expect(state.step).toBeNull()
    expect(state.suggestedSlots).toHaveLength(0)
  })
})
