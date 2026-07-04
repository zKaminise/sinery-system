/**
 * Subscription status evaluation (pure — unit-testable). Given the stored
 * subscription fields and "now", derives the effective subscription status,
 * the clinic access status, and whether the clinic should be suspended for
 * non-payment. The DB-writing action layer persists the result.
 *
 * Rules (Prompt 21, Part 5):
 *  - FREE / EXEMPT never suspend for non-payment.
 *  - CANCELLED blocks access.
 *  - TRIALING while trialEndsAt is in the future stays active.
 *  - A due date in the future/today → ACTIVE; in the past → PAST_DUE.
 *  - PAST_DUE beyond graceDays (default 20) → SUSPENDED on day grace+1.
 */

export type SubscriptionStatusValue =
  | "FREE"
  | "TRIALING"
  | "ACTIVE"
  | "PAST_DUE"
  | "SUSPENDED"
  | "CANCELLED"
  | "EXEMPT"

/** Clinic access status the evaluation implies (subset of ClinicStatus). */
export type EvaluatedClinicStatus = "ACTIVE" | "SUSPENDED" | "INACTIVE"

export interface SubscriptionEvalInput {
  status: SubscriptionStatusValue
  trialEndsAt: Date | null
  nextDueDate: Date | null
  overdueSince: Date | null
  graceDays: number
  cancelledAt?: Date | null
}

export interface SubscriptionEvalResult {
  subscriptionStatus: SubscriptionStatusValue
  clinicStatus: EvaluatedClinicStatus
  overdueSince: Date | null
  overdueDays: number
  shouldSuspend: boolean
}

/** Whole calendar days from `from` to `to` (UTC date granularity). */
export function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate())
  return Math.floor((b - a) / 86_400_000)
}

export function evaluateSubscriptionStatus(
  input: SubscriptionEvalInput,
  now: Date
): SubscriptionEvalResult {
  const graceDays = Number.isFinite(input.graceDays) ? input.graceDays : 20

  // Non-billable statuses: never suspend for payment.
  if (input.status === "FREE") {
    return { subscriptionStatus: "FREE", clinicStatus: "ACTIVE", overdueSince: null, overdueDays: 0, shouldSuspend: false }
  }
  if (input.status === "EXEMPT") {
    return { subscriptionStatus: "EXEMPT", clinicStatus: "ACTIVE", overdueSince: null, overdueDays: 0, shouldSuspend: false }
  }
  if (input.status === "CANCELLED" || input.cancelledAt) {
    return { subscriptionStatus: "CANCELLED", clinicStatus: "SUSPENDED", overdueSince: input.overdueSince, overdueDays: 0, shouldSuspend: false }
  }

  // Trial still running.
  if (input.status === "TRIALING" && input.trialEndsAt && daysBetween(now, input.trialEndsAt) >= 0) {
    return { subscriptionStatus: "TRIALING", clinicStatus: "ACTIVE", overdueSince: null, overdueDays: 0, shouldSuspend: false }
  }

  // The reference due date: an expired trial behaves like a due date.
  const effectiveDue =
    input.nextDueDate ??
    (input.status === "TRIALING" ? input.trialEndsAt : null)

  // No due date configured → treat as active (e.g. manually-managed active plan).
  if (!effectiveDue) {
    return { subscriptionStatus: "ACTIVE", clinicStatus: "ACTIVE", overdueSince: null, overdueDays: 0, shouldSuspend: false }
  }

  const daysPastDue = daysBetween(effectiveDue, now)

  // Due today or in the future → active, clears any overdue marker.
  if (daysPastDue <= 0) {
    return { subscriptionStatus: "ACTIVE", clinicStatus: "ACTIVE", overdueSince: null, overdueDays: 0, shouldSuspend: false }
  }

  const overdueSince = input.overdueSince ?? effectiveDue
  const overdueDays = daysBetween(overdueSince, now)

  if (overdueDays > graceDays) {
    return { subscriptionStatus: "SUSPENDED", clinicStatus: "SUSPENDED", overdueSince, overdueDays, shouldSuspend: true }
  }

  return { subscriptionStatus: "PAST_DUE", clinicStatus: "ACTIVE", overdueSince, overdueDays, shouldSuspend: false }
}
