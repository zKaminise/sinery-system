import { describe, it, expect } from "vitest"

import { resolveTenantFromHost } from "@/lib/platform/tenant-resolver"
import { evaluateEnvReadiness, type EnvSnapshot } from "@/lib/env/env-readiness"
import { isCheckoutOriginAllowed } from "@/lib/asaas/checkout-origin"

const ROOT = "sinery.com.br"
const opts = { rootDomain: ROOT, defaultSlug: "sorria-odonto" }

describe("tenant resolver — production hostnames", () => {
  it("sinery.com.br / www → marketing (not a clinic)", () => {
    expect(resolveTenantFromHost("sinery.com.br", opts).kind).toBe("marketing")
    expect(resolveTenantFromHost("www.sinery.com.br", opts).kind).toBe("marketing")
  })
  it("app.sinery.com.br → app root", () => {
    expect(resolveTenantFromHost("app.sinery.com.br", opts).kind).toBe("app")
  })
  it("hml/staging .app.sinery.com.br → app (both reserved, not a clinic)", () => {
    expect(resolveTenantFromHost("hml.app.sinery.com.br", opts).kind).toBe("app")
    expect(resolveTenantFromHost("staging.app.sinery.com.br", opts).kind).toBe("app")
  })
  it("sorria.app.sinery.com.br → clinic sorria", () => {
    expect(resolveTenantFromHost("sorria.app.sinery.com.br", opts)).toEqual({ kind: "clinic", slug: "sorria" })
  })
  it("reserved subdomains never resolve as clinic", () => {
    for (const h of ["admin.app.sinery.com.br", "api.app.sinery.com.br", "checkout.app.sinery.com.br", "dev.app.sinery.com.br"]) {
      expect(resolveTenantFromHost(h, opts).kind, h).toBe("app")
    }
  })
  it("localhost → default tenant", () => {
    expect(resolveTenantFromHost("localhost:3000", opts)).toEqual({ kind: "default", slug: "sorria-odonto" })
  })
})

const STRONG = "kJ8f2p9Qx7Lm3Vw6Rt1Zc4Yb0Nh5Dg8Ae2Uf7Ss="

function snapshot(overrides: Partial<EnvSnapshot> = {}): EnvSnapshot {
  return {
    appEnv: "staging",
    hasDatabaseUrl: true,
    authSecret: STRONG,
    hasAppUrl: true,
    emailMockMode: true,
    hasResendKey: false,
    hasResendFrom: true,
    asaasEnabled: false,
    asaasMockMode: true,
    hasAsaasKey: false,
    hasAsaasWebhookToken: false,
    whatsappSendEnabled: false,
    whatsappSendMockMode: false,
    whatsappVerifySignature: true,
    hasWhatsappToken: false,
    hasWhatsappAppSecret: false,
    assistUseRealAi: false,
    hasOpenAiKey: false,
    hasSentryDsn: true,
    ...overrides,
  }
}

describe("env readiness", () => {
  it("staging with mocks + strong secret is ready for staging (not production)", () => {
    const r = evaluateEnvReadiness(snapshot())
    expect(r.readyForStaging).toBe(true)
    expect(r.readyForProduction).toBe(false) // EMAIL_MOCK_MODE=true blocks prod
    expect(r.criticalIssues.join(" ")).toContain("EMAIL_MOCK_MODE")
  })

  it("weak/placeholder AUTH_SECRET blocks staging AND production", () => {
    const weak = evaluateEnvReadiness(snapshot({ authSecret: "change-me-in-development" }))
    expect(weak.readyForStaging).toBe(false)
    expect(weak.readyForProduction).toBe(false)
    expect(weak.criticalIssues.join(" ")).toContain("AUTH_SECRET")
  })

  it("missing DATABASE_URL is reported and blocks readiness", () => {
    const r = evaluateEnvReadiness(snapshot({ hasDatabaseUrl: false }))
    expect(r.missingRequired).toContain("DATABASE_URL")
    expect(r.readyForStaging).toBe(false)
  })

  it("production-ready when mocks off + all real keys present", () => {
    const r = evaluateEnvReadiness(
      snapshot({
        appEnv: "production",
        emailMockMode: false,
        hasResendKey: true,
        asaasEnabled: true,
        asaasMockMode: false,
        hasAsaasKey: true,
        hasAsaasWebhookToken: true,
      })
    )
    expect(r.missingRequired).toEqual([])
    expect(r.criticalIssues).toEqual([])
    expect(r.readyForProduction).toBe(true)
  })

  it("real email without RESEND_API_KEY is missing-required", () => {
    const r = evaluateEnvReadiness(snapshot({ emailMockMode: false, hasResendKey: false }))
    expect(r.missingRequired).toContain("RESEND_API_KEY")
  })

  it("never leaks secret values (only names/booleans)", () => {
    const r = evaluateEnvReadiness(snapshot({ authSecret: STRONG }))
    expect(JSON.stringify(r)).not.toContain(STRONG)
  })
})

describe("checkout origin", () => {
  it("allows a matching origin and blocks others in staging/prod", () => {
    const csv = "https://sinery.com.br,https://www.sinery.com.br"
    expect(isCheckoutOriginAllowed("https://sinery.com.br", csv, "production")).toBe(true)
    expect(isCheckoutOriginAllowed("https://www.sinery.com.br/", csv, "staging")).toBe(true)
    expect(isCheckoutOriginAllowed("https://evil.com", csv, "production")).toBe(false)
  })
  it("no Origin header (server/curl) is allowed", () => {
    expect(isCheckoutOriginAllowed(null, "https://sinery.com.br", "production")).toBe(true)
  })
  it("no allowed-list configured: only local dev passes", () => {
    expect(isCheckoutOriginAllowed("http://localhost:3000", "", "local")).toBe(true)
    expect(isCheckoutOriginAllowed("https://sinery.com.br", "", "staging")).toBe(false)
  })
})
