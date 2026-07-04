import { describe, it, expect } from "vitest"

import {
  validateAuthSecret,
  PLACEHOLDER_AUTH_SECRETS,
  MIN_AUTH_SECRET_LENGTH,
} from "@/lib/auth-secret"

const STRONG = "kJ8f2p9Qx7Lm3Vw6Rt1Zc4Yb0Nh5Dg8Ae2Uf7Ss=" // >= 32 chars

describe("validateAuthSecret", () => {
  it("rejects a missing secret in any environment", () => {
    expect(validateAuthSecret(undefined, false).ok).toBe(false)
    expect(validateAuthSecret(undefined, true).ok).toBe(false)
    expect(validateAuthSecret("", true).ok).toBe(false)
  })

  it("allows any non-empty secret in development", () => {
    expect(validateAuthSecret("change-me-in-development", false).ok).toBe(true)
    expect(validateAuthSecret("short", false).ok).toBe(true)
  })

  it("rejects known placeholder values in production", () => {
    for (const placeholder of PLACEHOLDER_AUTH_SECRETS) {
      const result = validateAuthSecret(placeholder, true)
      expect(result.ok, `placeholder "${placeholder}" must be rejected in prod`).toBe(false)
      expect(result.error).toBeTruthy()
    }
  })

  it("rejects placeholders case-insensitively / with surrounding spaces in production", () => {
    expect(validateAuthSecret("  Change-Me-In-Development  ", true).ok).toBe(false)
  })

  it("rejects a too-short secret in production", () => {
    expect(validateAuthSecret("a".repeat(MIN_AUTH_SECRET_LENGTH - 1), true).ok).toBe(false)
  })

  it("accepts a strong secret in production", () => {
    expect(STRONG.length).toBeGreaterThanOrEqual(MIN_AUTH_SECRET_LENGTH)
    expect(validateAuthSecret(STRONG, true).ok).toBe(true)
  })
})
