import { describe, it, expect } from "vitest"

import { resolveTenantFromHost } from "@/lib/platform/tenant-resolver"
import { buildTenantUrl } from "@/lib/tenant/tenant-url"
import {
  parseSubdomainEnforced,
  evaluateRootLoginAccess,
  resolveLoginClinicScope,
  evaluateTenantSessionBinding,
  evaluateFounderHostAccess,
  shouldUseDefaultTenant,
  loginErrorFor,
  LOGIN_ERROR_GENERIC,
  LOGIN_ERROR_TENANT,
} from "@/lib/tenant/tenant-security"

/**
 * Multi-tenant subdomain SECURITY (Prompt 27, Part 6). All pure — no DB, no
 * network. Full login+DB flows are covered by the manual test plan in
 * docs/hml-qa-test-plan.md; these lock in the decision logic.
 */

const ROOT = "sinery.com.br"
const HML = { rootDomain: ROOT, appPrefix: "hml.app" }
const PRD = { rootDomain: ROOT, appPrefix: "app" }

// ---------- Resolver: root vs tenant, HML + PRD (Part 6: 1-4) ----------
describe("resolveTenantFromHost — root vs clinic (HML + PRD)", () => {
  it("HML root hml.app.sinery.com.br → app (NOT a clinic)", () => {
    expect(resolveTenantFromHost("hml.app.sinery.com.br", HML).kind).toBe("app")
  })
  it("HML clinic clinicateste.hml.app.sinery.com.br → clinic clinicateste", () => {
    expect(resolveTenantFromHost("clinicateste.hml.app.sinery.com.br", HML)).toEqual({
      kind: "clinic",
      slug: "clinicateste",
    })
  })
  it("PRD root app.sinery.com.br → app (NOT a clinic)", () => {
    expect(resolveTenantFromHost("app.sinery.com.br", PRD).kind).toBe("app")
  })
  it("PRD clinic clinicateste.app.sinery.com.br → clinic clinicateste", () => {
    expect(resolveTenantFromHost("clinicateste.app.sinery.com.br", PRD)).toEqual({
      kind: "clinic",
      slug: "clinicateste",
    })
  })
  it("marketing + reserved subdomains never resolve to a clinic", () => {
    expect(resolveTenantFromHost("sinery.com.br", HML).kind).toBe("marketing")
    expect(resolveTenantFromHost("www.sinery.com.br", HML).kind).toBe("marketing")
    expect(resolveTenantFromHost("founder.hml.app.sinery.com.br", HML).kind).toBe("app")
    expect(resolveTenantFromHost("api.app.sinery.com.br", PRD).kind).toBe("app")
  })
})

// ---------- Root-login block, flag + env gated (Part 6: 5) ----------
describe("evaluateRootLoginAccess — root login blocked only when enforced + staging/prod", () => {
  it("staging + enforced + root(app) → BLOCKED", () => {
    expect(
      evaluateRootLoginAccess({ appEnv: "staging", hostKind: "app", enforced: true }).blocked
    ).toBe(true)
  })
  it("production + enforced + marketing root → BLOCKED", () => {
    expect(
      evaluateRootLoginAccess({ appEnv: "production", hostKind: "marketing", enforced: true }).blocked
    ).toBe(true)
  })
  it("staging + enforced + CLINIC host → allowed (clinic login is the point)", () => {
    expect(
      evaluateRootLoginAccess({ appEnv: "staging", hostKind: "clinic", enforced: true }).blocked
    ).toBe(false)
  })
  it("staging but NOT enforced → allowed (transition before wildcard DNS)", () => {
    expect(
      evaluateRootLoginAccess({ appEnv: "staging", hostKind: "app", enforced: false }).blocked
    ).toBe(false)
  })
  it("local is never blocked, even enforced", () => {
    expect(
      evaluateRootLoginAccess({ appEnv: "local", hostKind: "app", enforced: true }).blocked
    ).toBe(false)
  })
})

// ---------- Login clinic scope + cross-subdomain denial (Part 6: 6) ----------
describe("resolveLoginClinicScope — login is scoped to the host clinic", () => {
  it("clinic host → returns the slug (lookup is scoped to that clinic)", () => {
    expect(resolveLoginClinicScope({ kind: "clinic", slug: "clinica-a" })).toBe("clinica-a")
  })
  it("root/app host → null (email-only fallback)", () => {
    expect(resolveLoginClinicScope({ kind: "app" })).toBeNull()
    expect(resolveLoginClinicScope({ kind: "marketing" })).toBeNull()
    expect(resolveLoginClinicScope({ kind: "default", slug: "sorria-odonto" })).toBeNull()
  })
  it("a clinic-A user on clinic-B host is scoped to B (so A's email won't match)", () => {
    // The scope is B — the auth layer then looks up (email, clinicId=B) and finds
    // no membership for a clinic-A user → generic denial even with a valid password.
    const hostB = resolveTenantFromHost("clinica-b.hml.app.sinery.com.br", HML)
    expect(resolveLoginClinicScope(hostB)).toBe("clinica-b")
  })
})

// ---------- Session ↔ host binding (Part 6: 7) ----------
describe("evaluateTenantSessionBinding — session must match the host clinic", () => {
  it("clinic host + mismatched session → DENY (tenant_session_mismatch)", () => {
    expect(
      evaluateTenantSessionBinding({ hostKind: "clinic", hostSlug: "clinica-b", sessionSlug: "clinica-a" })
    ).toEqual({ action: "deny", reason: "tenant_session_mismatch" })
  })
  it("clinic host + matching session → allow", () => {
    expect(
      evaluateTenantSessionBinding({ hostKind: "clinic", hostSlug: "clinica-a", sessionSlug: "clinica-a" }).action
    ).toBe("allow")
  })
  it("root/app host → allow (no tenant to bind; keeps HML root working)", () => {
    expect(
      evaluateTenantSessionBinding({ hostKind: "app", hostSlug: null, sessionSlug: "clinica-a" }).action
    ).toBe("allow")
  })
  it("older cookie without a slug → allow (can't prove mismatch; DB re-validates)", () => {
    expect(
      evaluateTenantSessionBinding({ hostKind: "clinic", hostSlug: "clinica-a", sessionSlug: null }).action
    ).toBe("allow")
  })
})

// ---------- Founder is root-only (Part 6: 8) ----------
describe("evaluateFounderHostAccess — platform admin lives at the root", () => {
  it("root works", () => {
    expect(evaluateFounderHostAccess("app").action).toBe("allow")
    expect(evaluateFounderHostAccess("marketing").action).toBe("allow")
  })
  it("clinic subdomain → redirect back to root", () => {
    expect(evaluateFounderHostAccess("clinic").action).toBe("redirect_root")
  })
})

// ---------- DEFAULT_TENANT_SLUG is local-only (Part 6: 9) ----------
describe("shouldUseDefaultTenant — no default clinic at root in staging/prod", () => {
  it("local → true", () => {
    expect(shouldUseDefaultTenant("local")).toBe(true)
  })
  it("staging + production → false", () => {
    expect(shouldUseDefaultTenant("staging")).toBe(false)
    expect(shouldUseDefaultTenant("production")).toBe(false)
  })
})

// ---------- Flag parsing + error messages ----------
describe("flag parsing + generic (existence-hiding) errors", () => {
  it("parseSubdomainEnforced only true for exactly 'true'", () => {
    expect(parseSubdomainEnforced("true")).toBe(true)
    expect(parseSubdomainEnforced("TRUE")).toBe(true)
    expect(parseSubdomainEnforced("false")).toBe(false)
    expect(parseSubdomainEnforced("")).toBe(false)
    expect(parseSubdomainEnforced(undefined)).toBe(false)
  })
  it("loginErrorFor uses the tenant message on a clinic host, generic otherwise", () => {
    expect(loginErrorFor({ kind: "clinic", slug: "x" })).toBe(LOGIN_ERROR_TENANT)
    expect(loginErrorFor({ kind: "app" })).toBe(LOGIN_ERROR_GENERIC)
    expect(loginErrorFor(null)).toBe(LOGIN_ERROR_GENERIC)
  })
})

// ---------- URL builder by environment (Part 6: 10) ----------
describe("buildTenantUrl — staging + production", () => {
  it("staging base + slug → {slug}.hml.app.sinery.com.br", () => {
    expect(buildTenantUrl("clinicateste", "https://hml.app.sinery.com.br")).toBe(
      "https://clinicateste.hml.app.sinery.com.br"
    )
  })
  it("production base + slug → {slug}.app.sinery.com.br", () => {
    expect(buildTenantUrl("clinicateste", "https://app.sinery.com.br")).toBe(
      "https://clinicateste.app.sinery.com.br"
    )
  })
  it("reserved slug never yields a tenant URL", () => {
    expect(buildTenantUrl("founder", "https://hml.app.sinery.com.br")).toBe("https://hml.app.sinery.com.br")
  })
})
