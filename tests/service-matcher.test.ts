import { describe, it, expect } from "vitest"

import { matchServiceFromMessage } from "@/lib/assist/service-matcher"

const SERVICES = [
  { id: "s1", name: "Avaliação inicial" },
  { id: "s2", name: "Limpeza" },
  { id: "s3", name: "Clareamento" },
  { id: "s4", name: "Manutenção ortodôntica" },
  { id: "s5", name: "Tratamento de canal" },
]

describe("matchServiceFromMessage", () => {
  it("matches by exact name (accent-insensitive)", () => {
    const r = matchServiceFromMessage("quero uma limpeza", SERVICES)
    expect(r.status).toBe("match")
    if (r.status === "match") expect(r.service.id).toBe("s2")
  })

  it("matches 'avaliação' → Avaliação inicial", () => {
    const r = matchServiceFromMessage("preciso de uma avaliacao", SERVICES)
    expect(r.status).toBe("match")
    if (r.status === "match") expect(r.service.id).toBe("s1")
  })

  it("matches by alias 'canal' → Tratamento de canal", () => {
    const r = matchServiceFromMessage("acho que preciso de canal", SERVICES)
    expect(r.status).toBe("match")
    if (r.status === "match") expect(r.service.id).toBe("s5")
  })

  it("matches alias 'profilaxia' → Limpeza", () => {
    const r = matchServiceFromMessage("quero fazer profilaxia", SERVICES)
    expect(r.status).toBe("match")
    if (r.status === "match") expect(r.service.id).toBe("s2")
  })

  it("matches alias 'aparelho' → Manutenção ortodôntica", () => {
    const r = matchServiceFromMessage("manutenção do aparelho", SERVICES)
    expect(r.status).toBe("match")
    if (r.status === "match") expect(r.service.id).toBe("s4")
  })

  it("returns none for an unknown service", () => {
    expect(matchServiceFromMessage("quero um raio-x panorâmico", SERVICES).status).toBe("none")
  })

  it("returns ambiguous when two services match", () => {
    const r = matchServiceFromMessage("quero limpeza ou clareamento", SERVICES)
    expect(r.status).toBe("ambiguous")
    if (r.status === "ambiguous") expect(r.candidates.length).toBe(2)
  })
})
