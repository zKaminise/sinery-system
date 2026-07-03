import { describe, it, expect } from "vitest"

import { evaluateAssistLoop } from "@/lib/ai/assist-loop-core"

describe("evaluateAssistLoop", () => {
  it("flags 3 repeated AI replies", () => {
    const r = evaluateAssistLoop({
      recentAiReplies: ["Não entendi a data.", "Não entendi a data.", "Não entendi a data."],
      recentSteps: ["WAITING_DATE", "WAITING_DATE"],
      toolFailuresLast10min: 0,
    })
    expect(r.loop).toBe(true)
    expect(r.reason).toBe("repeated_replies")
  })

  it("flags 3+ tool failures", () => {
    const r = evaluateAssistLoop({ recentAiReplies: [], recentSteps: [], toolFailuresLast10min: 3 })
    expect(r.loop).toBe(true)
    expect(r.reason).toBe("tool_failures")
  })

  it("flags a step stuck more than 4 times", () => {
    const r = evaluateAssistLoop({
      recentAiReplies: [],
      recentSteps: ["WAITING_SLOT_SELECTION", "WAITING_SLOT_SELECTION", "WAITING_SLOT_SELECTION", "WAITING_SLOT_SELECTION", "WAITING_SLOT_SELECTION"],
      toolFailuresLast10min: 0,
    })
    expect(r.loop).toBe(true)
    expect(r.reason).toBe("stuck_step")
  })

  it("does NOT flag a healthy conversation", () => {
    const r = evaluateAssistLoop({
      recentAiReplies: ["Encontrei estes horários...", "Perfeito! Agendado."],
      recentSteps: ["WAITING_DATE", "WAITING_SLOT_SELECTION", "COMPLETED"],
      toolFailuresLast10min: 0,
    })
    expect(r.loop).toBe(false)
  })
})
