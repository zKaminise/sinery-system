import { describe, it, expect } from "vitest"

import { startCheckoutSchema } from "@/lib/validators/checkout"
import {
  parseAsaasWebhook,
  verifyAsaasWebhookToken,
  isProvisioningEvent,
  isOverdueEvent,
  asaasPayloadHash,
} from "@/lib/asaas/asaas-webhook"
import { billingIntervalToAsaasCycle } from "@/lib/asaas/asaas-mappers"

describe("checkout input validation", () => {
  const valid = {
    planSlug: "pro-clinic",
    clinicName: "Clínica Sorria",
    desiredSlug: "clinica-sorria",
    ownerName: "Ana Silva",
    ownerEmail: "ana@clinica.com.br",
  }

  it("accepts valid input", () => {
    expect(startCheckoutSchema.safeParse(valid).success).toBe(true)
  })

  it("never accepts a price/amount/clinicId from the site", () => {
    const parsed = startCheckoutSchema.safeParse({ ...valid, amountInCents: 1, price: 1, clinicId: "x", planId: "y" })
    expect(parsed.success).toBe(true)
    const data = parsed.data as Record<string, unknown>
    expect(data.amountInCents).toBeUndefined()
    expect(data.price).toBeUndefined()
    expect(data.clinicId).toBeUndefined()
    expect(data.planId).toBeUndefined()
  })

  it("rejects missing plan / bad email", () => {
    expect(startCheckoutSchema.safeParse({ ...valid, planSlug: "" }).success).toBe(false)
    expect(startCheckoutSchema.safeParse({ ...valid, ownerEmail: "nope" }).success).toBe(false)
  })
})

describe("asaas webhook", () => {
  const confirmed = { event: "PAYMENT_CONFIRMED", payment: { id: "pay_1", subscription: "sub_1", customer: "cus_1", value: 397, status: "CONFIRMED", externalReference: "chk_1" } }

  it("parses PAYMENT_CONFIRMED / PAYMENT_RECEIVED", () => {
    const p = parseAsaasWebhook(confirmed)
    expect(p?.eventType).toBe("PAYMENT_CONFIRMED")
    expect(p?.paymentId).toBe("pay_1")
    expect(p?.subscriptionId).toBe("sub_1")
    expect(p?.valueInCents).toBe(39700)
    expect(isProvisioningEvent("PAYMENT_RECEIVED")).toBe(true)
    expect(isProvisioningEvent("PAYMENT_CONFIRMED")).toBe(true)
    expect(isProvisioningEvent("PAYMENT_CREATED")).toBe(false)
    expect(isOverdueEvent("PAYMENT_OVERDUE")).toBe(true)
  })

  it("returns null for garbage", () => {
    expect(parseAsaasWebhook(null)).toBeNull()
    expect(parseAsaasWebhook({ foo: "bar" })).toBeNull()
  })

  it("verifies the webhook token (timing-safe) and rejects mismatches / missing config", () => {
    expect(verifyAsaasWebhookToken("secret123", "secret123")).toBe(true)
    expect(verifyAsaasWebhookToken("wrong", "secret123")).toBe(false)
    expect(verifyAsaasWebhookToken(null, "secret123")).toBe(false)
    expect(verifyAsaasWebhookToken("anything", "")).toBe(false) // no token configured → reject
  })

  it("payloadHash is stable + idempotent per event", () => {
    const p = parseAsaasWebhook(confirmed)!
    const h1 = asaasPayloadHash(p)
    const h2 = asaasPayloadHash(parseAsaasWebhook(confirmed)!)
    expect(h1).toBe(h2)
    const other = asaasPayloadHash(parseAsaasWebhook({ ...confirmed, event: "PAYMENT_RECEIVED" })!)
    expect(other).not.toBe(h1)
  })
})

describe("asaas mappers", () => {
  it("maps subscribable intervals to Asaas cycles", () => {
    expect(billingIntervalToAsaasCycle("MONTHLY")).toBe("MONTHLY")
    expect(billingIntervalToAsaasCycle("YEARLY")).toBe("YEARLY")
    expect(billingIntervalToAsaasCycle("FREE")).toBeNull()
    expect(billingIntervalToAsaasCycle("ONE_TIME")).toBeNull()
  })
})
