import { describe, it, expect } from "vitest"

import { buildTenantUrl, deriveAppPrefix, appBaseUrl } from "@/lib/tenant/tenant-url"
import { resolveTenantFromHost } from "@/lib/platform/tenant-resolver"
import { detectIntent, isPastDate } from "@/lib/assist/intent-detector"
import { buildDefaultKnowledgeBase } from "@/lib/assist/default-knowledge-base"

// ---------- Tenant URL by environment (Part 8: 1-4) ----------
describe("buildTenantUrl — environment-aware", () => {
  it("HML: https://hml.app.sinery.com.br + slug → https://clinica-teste.hml.app.sinery.com.br", () => {
    expect(buildTenantUrl("clinica-teste", "https://hml.app.sinery.com.br")).toBe("https://clinica-teste.hml.app.sinery.com.br")
  })
  it("PRD: https://app.sinery.com.br + slug → https://clinica-teste.app.sinery.com.br", () => {
    expect(buildTenantUrl("clinica-teste", "https://app.sinery.com.br")).toBe("https://clinica-teste.app.sinery.com.br")
  })
  it("reserved slug never produces a tenant URL (returns base app URL)", () => {
    expect(buildTenantUrl("app", "https://hml.app.sinery.com.br")).toBe("https://hml.app.sinery.com.br")
    expect(buildTenantUrl("admin", "https://app.sinery.com.br")).toBe("https://app.sinery.com.br")
  })
  it("local does not break — returns the base app URL (no subdomain)", () => {
    expect(buildTenantUrl("clinica-teste", "http://localhost:3000")).toBe("http://localhost:3000")
  })
  it("strips www and keeps protocol/port", () => {
    expect(appBaseUrl("https://www.app.sinery.com.br")).toBe("https://app.sinery.com.br")
    expect(buildTenantUrl("x", "http://www.example.com:8080")).toBe("http://x.example.com:8080")
  })
  it("deriveAppPrefix: hml.app in staging, app in prod", () => {
    expect(deriveAppPrefix("https://hml.app.sinery.com.br", "sinery.com.br")).toBe("hml.app")
    expect(deriveAppPrefix("https://app.sinery.com.br", "sinery.com.br")).toBe("app")
  })
})

// ---------- Tenant resolver with appPrefix (Part 8: 5-8) ----------
describe("resolveTenantFromHost — HML + PRD subdomains", () => {
  const root = "sinery.com.br"
  it("clinica-teste.hml.app.sinery.com.br → clinic clinica-teste (staging appPrefix)", () => {
    expect(resolveTenantFromHost("clinica-teste.hml.app.sinery.com.br", { rootDomain: root, appPrefix: "hml.app" })).toEqual({ kind: "clinic", slug: "clinica-teste" })
  })
  it("hml.app.sinery.com.br → app (not a clinic)", () => {
    expect(resolveTenantFromHost("hml.app.sinery.com.br", { rootDomain: root, appPrefix: "hml.app" }).kind).toBe("app")
  })
  it("app.sinery.com.br → app (not a clinic)", () => {
    expect(resolveTenantFromHost("app.sinery.com.br", { rootDomain: root, appPrefix: "app" }).kind).toBe("app")
  })
  it("clinica-teste.app.sinery.com.br → clinic clinica-teste (prod appPrefix)", () => {
    expect(resolveTenantFromHost("clinica-teste.app.sinery.com.br", { rootDomain: root, appPrefix: "app" })).toEqual({ kind: "clinic", slug: "clinica-teste" })
  })
  it("marketing + reserved subdomains stay non-clinic", () => {
    expect(resolveTenantFromHost("sinery.com.br", { rootDomain: root }).kind).toBe("marketing")
    expect(resolveTenantFromHost("www.sinery.com.br", { rootDomain: root }).kind).toBe("marketing")
    expect(resolveTenantFromHost("admin.hml.app.sinery.com.br", { rootDomain: root, appPrefix: "hml.app" }).kind).toBe("app")
  })
})

// ---------- Assist intents (Part 8: 15, 17, 20, 21) ----------
describe("Assist — intent detection", () => {
  it("'Quais serviços vocês realizam?' → ASK_SERVICES (not schedule/transfer)", () => {
    expect(detectIntent("Quais serviços vocês realizam por favor")).toBe("ASK_SERVICES")
    expect(detectIntent("o que vocês fazem?")).toBe("ASK_SERVICES")
  })
  it("'quero falar com atendente' → HUMAN_HELP", () => {
    expect(detectIntent("quero falar com atendente")).toBe("HUMAN_HELP")
  })
  it("'estou com dor forte' → EMERGENCY_OR_SENSITIVE", () => {
    expect(detectIntent("estou com dor forte")).toBe("EMERGENCY_OR_SENSITIVE")
  })
  it("'quero marcar limpeza' still schedules (not confused with services)", () => {
    expect(detectIntent("quero marcar uma limpeza amanhã")).toBe("SCHEDULE_APPOINTMENT")
  })
  it("isPastDate: past date true, future false", () => {
    const tz = "America/Sao_Paulo"
    expect(isPastDate("2000-01-01", tz)).toBe(true)
    expect(isPastDate("2999-12-31", tz)).toBe(false)
  })
})

// ---------- New-clinic AI base (Part 7) ----------
describe("buildDefaultKnowledgeBase", () => {
  it("returns generic editable entries including greeting + no-diagnosis notice", () => {
    const kb = buildDefaultKnowledgeBase({ clinicName: "Clínica Teste", city: "Uberlândia", state: "MG" })
    expect(kb.length).toBeGreaterThanOrEqual(5)
    const titles = kb.map((k) => k.title)
    expect(titles).toContain("Saudação")
    const joined = kb.map((k) => k.content).join(" ")
    expect(joined).toContain("Clínica Teste")
    expect(joined.toLowerCase()).toContain("não faço diagnóstic")
    expect(joined).toContain("Uberlândia - MG")
  })
})
