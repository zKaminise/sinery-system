/**
 * Platform (founder) role permissions (pure — unit-testable). Mirrors the
 * per-clinic lib/permissions.ts pattern but for PlatformUser roles.
 *
 *   FOUNDER        — full control.
 *   PLATFORM_ADMIN — full operational control (clinics + billing + plans).
 *   FINANCE        — billing/invoices, but not creating clinics or plans.
 *   SUPPORT        — read-only-ish: view clinics, cannot touch financials/plans.
 */

export type PlatformRoleValue = "FOUNDER" | "PLATFORM_ADMIN" | "SUPPORT" | "FINANCE"

/** Can see the founder panel at all. */
export function canViewPlatform(role: PlatformRoleValue): boolean {
  return role === "FOUNDER" || role === "PLATFORM_ADMIN" || role === "SUPPORT" || role === "FINANCE"
}

/** Full platform administration (settings, platform users). */
export function canManagePlatform(role: PlatformRoleValue): boolean {
  return role === "FOUNDER" || role === "PLATFORM_ADMIN"
}

/** Create/edit clinics and suspend/reactivate them. */
export function canManageClinics(role: PlatformRoleValue): boolean {
  return role === "FOUNDER" || role === "PLATFORM_ADMIN"
}

/** Manage billing: invoices, mark paid, recalc, subscription commercial fields. */
export function canManageBilling(role: PlatformRoleValue): boolean {
  return role === "FOUNDER" || role === "PLATFORM_ADMIN" || role === "FINANCE"
}

/** Create/edit commercial plans. */
export function canManagePlans(role: PlatformRoleValue): boolean {
  return role === "FOUNDER" || role === "PLATFORM_ADMIN"
}
