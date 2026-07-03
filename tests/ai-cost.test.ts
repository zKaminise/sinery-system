import { describe, it, expect } from "vitest"

import { estimateAiCostInCents } from "@/lib/ai/assist-cost"

describe("estimateAiCostInCents", () => {
  it("returns 0 for mock", () => {
    expect(estimateAiCostInCents({ model: "mock", inputTokens: 1000, outputTokens: 1000 })).toBe(0)
  })

  it("computes cost for a known model (gpt-4o-mini)", () => {
    // 100000*0.000015 + 50000*0.00006 = 1.5 + 3 = 4.5 → round 5 (wait: 4.5)
    const cost = estimateAiCostInCents({ model: "gpt-4o-mini", inputTokens: 100000, outputTokens: 50000 })
    expect(cost).toBe(Math.round(100000 * 0.000015 + 50000 * 0.00006))
    expect(cost).toBeGreaterThan(0)
  })

  it("longest-prefix matches dated model ids", () => {
    const a = estimateAiCostInCents({ model: "gpt-4o-mini-2024-07-18", inputTokens: 1_000_000, outputTokens: 0 })
    const b = estimateAiCostInCents({ model: "gpt-4o-mini", inputTokens: 1_000_000, outputTokens: 0 })
    expect(a).toBe(b)
  })

  it("returns null for an unknown model", () => {
    expect(estimateAiCostInCents({ model: "some-future-model", inputTokens: 100, outputTokens: 100 })).toBeNull()
  })

  it("treats missing tokens as 0 for a known model", () => {
    expect(estimateAiCostInCents({ model: "gpt-4o-mini" })).toBe(0)
  })

  it("returns 0 for an empty/undefined model", () => {
    expect(estimateAiCostInCents({ model: null, inputTokens: 100, outputTokens: 100 })).toBe(0)
  })
})
