import { describe, it, expect } from "vitest"

import { isOverLimit, decideClinicRateLimit } from "@/lib/ai/assist-rate-limit-core"

describe("isOverLimit", () => {
  it("is false under the limit", () => {
    expect(isOverLimit(5, 20)).toBe(false)
  })
  it("is true at/over the limit", () => {
    expect(isOverLimit(20, 20)).toBe(true)
    expect(isOverLimit(21, 20)).toBe(true)
  })
  it("treats limit <= 0 as unlimited", () => {
    expect(isOverLimit(9999, 0)).toBe(false)
  })
})

describe("decideClinicRateLimit", () => {
  it("allows when under both limits", () => {
    const d = decideClinicRateLimit({ perMinuteCount: 3, perMinuteLimit: 20, perDayCount: 50, perDayLimit: 1000 })
    expect(d.allowed).toBe(true)
  })
  it("blocks on per-minute first", () => {
    const d = decideClinicRateLimit({ perMinuteCount: 20, perMinuteLimit: 20, perDayCount: 50, perDayLimit: 1000 })
    expect(d.allowed).toBe(false)
    expect(d.reason).toBe("clinic_per_minute")
  })
  it("blocks on per-day", () => {
    const d = decideClinicRateLimit({ perMinuteCount: 1, perMinuteLimit: 20, perDayCount: 1000, perDayLimit: 1000 })
    expect(d.allowed).toBe(false)
    expect(d.reason).toBe("clinic_per_day")
  })
})
