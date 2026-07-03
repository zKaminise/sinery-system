import { describe, it, expect } from "vitest"

import { classifyAssistMessageRisk } from "@/lib/ai/assist-risk"

describe("classifyAssistMessageRisk", () => {
  it("LOW for a normal scheduling message", () => {
    expect(classifyAssistMessageRisk("quero marcar uma limpeza amanhã").level).toBe("LOW")
  })

  it("LOW for a simple address question", () => {
    expect(classifyAssistMessageRisk("qual o endereço e horário da clínica?").level).toBe("LOW")
  })

  it("HIGH for strong pain", () => {
    expect(classifyAssistMessageRisk("estou com muita dor no dente").level).toBe("HIGH")
  })

  it("HIGH for a medication request", () => {
    expect(classifyAssistMessageRisk("qual remédio posso tomar?").level).toBe("HIGH")
  })

  it("HIGH for a child in pain", () => {
    expect(classifyAssistMessageRisk("minha criança com dor de dente").level).toBe("HIGH")
  })

  it("CRITICAL for an emergency", () => {
    expect(classifyAssistMessageRisk("é uma emergência, socorro!").level).toBe("CRITICAL")
  })

  it("CRITICAL for self-harm", () => {
    expect(classifyAssistMessageRisk("não quero mais viver").level).toBe("CRITICAL")
  })

  it("MEDIUM for insurance/billing", () => {
    const r = classifyAssistMessageRisk("vocês aceitam meu convênio? quero um reembolso")
    expect(r.level).toBe("MEDIUM")
    expect(r.reasons.length).toBeGreaterThan(0)
  })
})
