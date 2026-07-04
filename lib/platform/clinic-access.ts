/**
 * Clinic access guard (pure — unit-testable). Decides whether a clinic user is
 * allowed into the clinic app based on the clinic's status. Used by the
 * authenticated clinic layout to show a clear "suspended" screen instead of a
 * confusing redirect loop.
 */

export type ClinicStatusValue = "ACTIVE" | "INACTIVE" | "SETUP_PENDING" | "SUSPENDED"

export type ClinicBlockReason = "suspended" | "inactive"

export interface ClinicAccess {
  blocked: boolean
  reason?: ClinicBlockReason
}

export function evaluateClinicAccess(status: ClinicStatusValue): ClinicAccess {
  if (status === "SUSPENDED") return { blocked: true, reason: "suspended" }
  if (status === "INACTIVE") return { blocked: true, reason: "inactive" }
  // ACTIVE and SETUP_PENDING can use the app (SETUP_PENDING shows an onboarding
  // hint elsewhere, but is not blocked).
  return { blocked: false }
}

export function isClinicAccessBlocked(status: ClinicStatusValue): boolean {
  return evaluateClinicAccess(status).blocked
}
