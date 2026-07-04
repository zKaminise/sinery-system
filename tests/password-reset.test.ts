import { describe, it, expect } from "vitest"

import {
  generateResetCode,
  hashResetCode,
  verifyResetCode,
  isResetExpired,
  attemptsExceeded,
  resendCooldownRemaining,
} from "@/lib/auth/password-reset-core"

const SECRET = "test-secret-abc"

describe("password reset core", () => {
  it("generates a numeric code of the requested length", () => {
    const code = generateResetCode(6)
    expect(code).toMatch(/^\d{6}$/)
    expect(generateResetCode(8)).toMatch(/^\d{8}$/)
  })

  it("hashes deterministically and never equals the code", () => {
    const h1 = hashResetCode("123456", SECRET)
    const h2 = hashResetCode("123456", SECRET)
    expect(h1).toBe(h2)
    expect(h1).not.toContain("123456")
    expect(hashResetCode("123456", "other")).not.toBe(h1)
  })

  it("verifies correct code and rejects wrong code (timing-safe)", () => {
    const hash = hashResetCode("654321", SECRET)
    expect(verifyResetCode("654321", hash, SECRET)).toBe(true)
    expect(verifyResetCode("000000", hash, SECRET)).toBe(false)
    expect(verifyResetCode("654321", hash, "wrong-secret")).toBe(false)
  })

  it("detects expiry", () => {
    const now = new Date("2026-07-04T12:00:00Z")
    expect(isResetExpired(new Date("2026-07-04T12:05:00Z"), now)).toBe(false)
    expect(isResetExpired(new Date("2026-07-04T11:59:00Z"), now)).toBe(true)
  })

  it("enforces max attempts", () => {
    expect(attemptsExceeded(4, 5)).toBe(false)
    expect(attemptsExceeded(5, 5)).toBe(true)
    expect(attemptsExceeded(6, 5)).toBe(true)
  })

  it("computes resend cooldown remaining", () => {
    const now = new Date("2026-07-04T12:01:00Z")
    expect(resendCooldownRemaining(new Date("2026-07-04T12:00:30Z"), 60, now)).toBe(30)
    expect(resendCooldownRemaining(new Date("2026-07-04T11:59:00Z"), 60, now)).toBe(0)
    expect(resendCooldownRemaining(null, 60, now)).toBe(0)
  })
})
