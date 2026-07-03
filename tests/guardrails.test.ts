import { describe, it, expect } from "vitest"

import { detectSensitiveOrEmergency } from "@/lib/ai/assist-guardrails"

describe("detectSensitiveOrEmergency", () => {
  it("flags strong pain", () => {
    expect(detectSensitiveOrEmergency("estou com muita dor no dente")).toBe(true)
  })

  it("flags medication requests", () => {
    expect(detectSensitiveOrEmergency("qual remédio devo tomar?")).toBe(true)
  })

  it("flags bleeding", () => {
    expect(detectSensitiveOrEmergency("minha gengiva está sangrando")).toBe(true)
  })

  it("flags a broken tooth / trauma", () => {
    expect(detectSensitiveOrEmergency("quebrei o dente, bati a boca")).toBe(true)
  })

  it("flags pregnancy", () => {
    expect(detectSensitiveOrEmergency("estou grávida, posso fazer?")).toBe(true)
  })

  it("does NOT flag a normal scheduling message", () => {
    expect(detectSensitiveOrEmergency("quero marcar uma limpeza amanhã à tarde")).toBe(false)
  })

  it("does NOT flag an address question", () => {
    expect(detectSensitiveOrEmergency("qual o endereço da clínica?")).toBe(false)
  })
})
