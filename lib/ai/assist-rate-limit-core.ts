/**
 * PURE rate-limit decision. The server wrapper (assist-rate-limit.ts) counts
 * recent usage in the DB and calls these. A limit <= 0 means "unlimited".
 */
export type RateLimitReason =
  | "clinic_per_minute"
  | "clinic_per_day"
  | "conversation_per_minute"
  | "tool_per_minute"

export interface RateLimitDecision {
  allowed: boolean
  reason: RateLimitReason | null
}

/** True when `count` has reached/exceeded a positive `limit`. */
export function isOverLimit(count: number, limit: number): boolean {
  if (limit <= 0) return false
  return count >= limit
}

export interface ClinicRateInputs {
  perMinuteCount: number
  perMinuteLimit: number
  perDayCount: number
  perDayLimit: number
}

/** Clinic-level decision: per-minute checked before per-day. */
export function decideClinicRateLimit(inputs: ClinicRateInputs): RateLimitDecision {
  if (isOverLimit(inputs.perMinuteCount, inputs.perMinuteLimit)) {
    return { allowed: false, reason: "clinic_per_minute" }
  }
  if (isOverLimit(inputs.perDayCount, inputs.perDayLimit)) {
    return { allowed: false, reason: "clinic_per_day" }
  }
  return { allowed: true, reason: null }
}

export const RATE_LIMIT_TRANSFER_MESSAGE =
  "Estamos com muitas solicitações no momento. Vou chamar alguém da equipe para te ajudar."
