import { describe, it, expect } from "vitest"

import { slugify, validateSlug, RESERVED_SLUGS } from "@/lib/platform/slug"
import { evaluateSubscriptionStatus } from "@/lib/billing/subscription-status"
import { monthlyAmountInCents, computeMrrInCents, computeArrInCents } from "@/lib/billing/revenue"
import { resolveTenantFromHost } from "@/lib/platform/tenant-resolver"
import {
  canManagePlatform,
  canManageBilling,
  canManageClinics,
  canManagePlans,
} from "@/lib/platform/platform-permissions"
import { evaluateClinicAccess } from "@/lib/platform/clinic-access"

const ROOT = "sinere.com.br"
const day = 86_400_000

describe("slug", () => {
  it("normalizes accents, spaces and case", () => {
    expect(slugify("Clínica São João")).toBe("clinica-sao-joao")
    expect(slugify("  Piloto   Alpha  ")).toBe("piloto-alpha")
    expect(slugify("Açaí & Cia!!!")).toBe("acai-cia")
  })

  it("accepts a valid slug", () => {
    expect(validateSlug("piloto-alpha").ok).toBe(true)
  })

  it("rejects invalid characters, spaces, and edge hyphens", () => {
    expect(validateSlug("Piloto Alpha").ok).toBe(false)
    expect(validateSlug("piloto_alpha").ok).toBe(false)
    expect(validateSlug("-alpha").ok).toBe(false)
    expect(validateSlug("ab").ok).toBe(false) // too short
  })

  it("blocks reserved slugs", () => {
    for (const s of ["admin", "api", "founder", "app", "www", "sinery", "sinere"]) {
      expect(RESERVED_SLUGS.has(s)).toBe(true)
      expect(validateSlug(s).ok, `"${s}" must be blocked`).toBe(false)
    }
  })
})

describe("subscription status", () => {
  const now = new Date("2026-07-04T12:00:00Z")
  const base = { graceDays: 20, cancelledAt: null as Date | null, trialEndsAt: null as Date | null }

  it("active when due date is in the future or today", () => {
    expect(
      evaluateSubscriptionStatus({ ...base, status: "ACTIVE", overdueSince: null, nextDueDate: new Date(now.getTime() + 5 * day) }, now)
        .subscriptionStatus
    ).toBe("ACTIVE")
    expect(
      evaluateSubscriptionStatus({ ...base, status: "ACTIVE", overdueSince: null, nextDueDate: now }, now).clinicStatus
    ).toBe("ACTIVE")
  })

  it("past_due after 1 day, still active clinic", () => {
    const r = evaluateSubscriptionStatus(
      { ...base, status: "ACTIVE", overdueSince: null, nextDueDate: new Date(now.getTime() - 1 * day) },
      now
    )
    expect(r.subscriptionStatus).toBe("PAST_DUE")
    expect(r.clinicStatus).toBe("ACTIVE")
    expect(r.shouldSuspend).toBe(false)
    expect(r.overdueDays).toBe(1)
  })

  it("suspends on day 21 (grace 20)", () => {
    const r = evaluateSubscriptionStatus(
      { ...base, status: "PAST_DUE", overdueSince: new Date(now.getTime() - 21 * day), nextDueDate: new Date(now.getTime() - 21 * day) },
      now
    )
    expect(r.subscriptionStatus).toBe("SUSPENDED")
    expect(r.clinicStatus).toBe("SUSPENDED")
    expect(r.shouldSuspend).toBe(true)
  })

  it("does NOT suspend exactly on day 20 (within grace)", () => {
    const r = evaluateSubscriptionStatus(
      { ...base, status: "PAST_DUE", overdueSince: new Date(now.getTime() - 20 * day), nextDueDate: new Date(now.getTime() - 20 * day) },
      now
    )
    expect(r.shouldSuspend).toBe(false)
    expect(r.subscriptionStatus).toBe("PAST_DUE")
  })

  it("FREE and EXEMPT never suspend", () => {
    for (const status of ["FREE", "EXEMPT"] as const) {
      const r = evaluateSubscriptionStatus(
        { ...base, status, overdueSince: new Date(now.getTime() - 400 * day), nextDueDate: new Date(now.getTime() - 400 * day) },
        now
      )
      expect(r.shouldSuspend).toBe(false)
      expect(r.clinicStatus).toBe("ACTIVE")
    }
  })

  it("CANCELLED blocks the clinic", () => {
    const r = evaluateSubscriptionStatus({ ...base, status: "CANCELLED", overdueSince: null, nextDueDate: null }, now)
    expect(r.subscriptionStatus).toBe("CANCELLED")
    expect(r.clinicStatus).toBe("SUSPENDED")
  })

  it("trial active while trialEndsAt is future", () => {
    const r = evaluateSubscriptionStatus(
      { ...base, status: "TRIALING", overdueSince: null, nextDueDate: null, trialEndsAt: new Date(now.getTime() + 3 * day) },
      now
    )
    expect(r.subscriptionStatus).toBe("TRIALING")
    expect(r.clinicStatus).toBe("ACTIVE")
  })
})

describe("revenue", () => {
  it("monthly amount by interval", () => {
    expect(monthlyAmountInCents(39700, "MONTHLY")).toBe(39700)
    expect(monthlyAmountInCents(397000, "YEARLY")).toBe(Math.round(397000 / 12))
    expect(monthlyAmountInCents(0, "FREE")).toBe(0)
    expect(monthlyAmountInCents(50000, "ONE_TIME")).toBe(0)
  })

  it("MRR counts only ACTIVE + PAST_DUE; ARR = MRR × 12", () => {
    const mrr = computeMrrInCents([
      { amountInCents: 39700, interval: "MONTHLY", status: "ACTIVE" },
      { amountInCents: 19700, interval: "MONTHLY", status: "PAST_DUE" },
      { amountInCents: 9700, interval: "MONTHLY", status: "TRIALING" }, // excluded
      { amountInCents: 0, interval: "FREE", status: "FREE" }, // excluded
      { amountInCents: 100000, interval: "MONTHLY", status: "SUSPENDED" }, // excluded
    ])
    expect(mrr).toBe(39700 + 19700)
    expect(computeArrInCents(mrr)).toBe(mrr * 12)
  })
})

describe("tenant resolver", () => {
  const opts = { rootDomain: ROOT, defaultSlug: "sorria-odonto" }
  it("localhost → default", () => {
    expect(resolveTenantFromHost("localhost:3000", opts)).toEqual({ kind: "default", slug: "sorria-odonto" })
  })
  it("app.<root> → app login", () => {
    expect(resolveTenantFromHost("app.sinere.com.br", opts).kind).toBe("app")
  })
  it("{slug}.app.<root> → clinic", () => {
    expect(resolveTenantFromHost("sorria.app.sinere.com.br", opts)).toEqual({ kind: "clinic", slug: "sorria" })
  })
  it("{slug}.<root> → clinic", () => {
    expect(resolveTenantFromHost("piloto-alpha.sinere.com.br", opts)).toEqual({ kind: "clinic", slug: "piloto-alpha" })
  })
  it("reserved subdomain does not resolve as clinic", () => {
    expect(resolveTenantFromHost("admin.sinere.com.br", opts).kind).toBe("app")
    expect(resolveTenantFromHost("api.app.sinere.com.br", opts).kind).toBe("app")
  })
  it("root/www → marketing", () => {
    expect(resolveTenantFromHost("sinere.com.br", opts).kind).toBe("marketing")
    expect(resolveTenantFromHost("www.sinere.com.br", opts).kind).toBe("marketing")
  })
})

describe("platform permissions", () => {
  it("FOUNDER manages everything", () => {
    expect(canManagePlatform("FOUNDER")).toBe(true)
    expect(canManageClinics("FOUNDER")).toBe(true)
    expect(canManageBilling("FOUNDER")).toBe(true)
    expect(canManagePlans("FOUNDER")).toBe(true)
  })
  it("FINANCE manages billing but not clinics/plans", () => {
    expect(canManageBilling("FINANCE")).toBe(true)
    expect(canManageClinics("FINANCE")).toBe(false)
    expect(canManagePlans("FINANCE")).toBe(false)
  })
  it("SUPPORT cannot manage financials or plans", () => {
    expect(canManageBilling("SUPPORT")).toBe(false)
    expect(canManagePlans("SUPPORT")).toBe(false)
    expect(canManageClinics("SUPPORT")).toBe(false)
  })
})

describe("clinic access guard", () => {
  it("ACTIVE and SETUP_PENDING allowed", () => {
    expect(evaluateClinicAccess("ACTIVE").blocked).toBe(false)
    expect(evaluateClinicAccess("SETUP_PENDING").blocked).toBe(false)
  })
  it("SUSPENDED and INACTIVE blocked", () => {
    expect(evaluateClinicAccess("SUSPENDED")).toEqual({ blocked: true, reason: "suspended" })
    expect(evaluateClinicAccess("INACTIVE")).toEqual({ blocked: true, reason: "inactive" })
  })
})
