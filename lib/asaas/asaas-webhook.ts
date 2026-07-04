import { createHash, timingSafeEqual } from "node:crypto"

/**
 * Asaas webhook helpers (pure — unit-testable). Token verification + payload
 * parsing + idempotency hashing.
 */

/** Timing-safe compare of the `asaas-access-token` header against the configured token. */
export function verifyAsaasWebhookToken(headerToken: string | null | undefined, expectedToken: string): boolean {
  if (!expectedToken) return false // no token configured → reject
  if (!headerToken) return false
  const a = Buffer.from(headerToken, "utf8")
  const b = Buffer.from(expectedToken, "utf8")
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export interface ParsedAsaasEvent {
  eventType: string
  paymentId?: string
  subscriptionId?: string
  customerId?: string
  valueInCents?: number
  status?: string
  externalReference?: string
}

/**
 * Parses an Asaas webhook payload. Shape: { event, payment: { id, subscription,
 * customer, value, status, externalReference } }. Never throws.
 */
export function parseAsaasWebhook(payload: unknown): ParsedAsaasEvent | null {
  if (!payload || typeof payload !== "object") return null
  const body = payload as Record<string, unknown>
  const event = body.event
  if (typeof event !== "string") return null
  const payment = (body.payment ?? {}) as Record<string, unknown>
  const value = typeof payment.value === "number" ? Math.round(payment.value * 100) : undefined
  return {
    eventType: event,
    paymentId: typeof payment.id === "string" ? payment.id : undefined,
    subscriptionId: typeof payment.subscription === "string" ? payment.subscription : undefined,
    customerId: typeof payment.customer === "string" ? payment.customer : undefined,
    valueInCents: value,
    status: typeof payment.status === "string" ? payment.status : undefined,
    externalReference: typeof payment.externalReference === "string" ? payment.externalReference : undefined,
  }
}

/** Events that confirm payment and should provision the clinic. */
export function isProvisioningEvent(eventType: string): boolean {
  return eventType === "PAYMENT_CONFIRMED" || eventType === "PAYMENT_RECEIVED"
}

export function isOverdueEvent(eventType: string): boolean {
  return eventType === "PAYMENT_OVERDUE"
}

export function isCancellationEvent(eventType: string): boolean {
  return eventType === "PAYMENT_DELETED" || eventType === "PAYMENT_REFUNDED" || eventType === "PAYMENT_CHARGEBACK_REQUESTED"
}

/** Stable idempotency hash for a webhook event (provider + event + payment + status). */
export function asaasPayloadHash(parsed: ParsedAsaasEvent): string {
  const key = ["asaas", parsed.eventType, parsed.paymentId ?? "", parsed.subscriptionId ?? "", parsed.status ?? ""].join(":")
  return createHash("sha256").update(key).digest("hex")
}
