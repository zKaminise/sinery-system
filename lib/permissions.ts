import type { UserRole } from "@/lib/generated/prisma/client"

/** Minimal user shape needed for permission decisions. */
export interface PermissionUser {
  id: string
  role: UserRole
  clinicId: string
}

/** Minimal target-user shape for user-management permission checks. */
export interface PermissionTargetUser {
  id: string
  role: UserRole
  clinicId: string
}

export function isOwnerOrAdmin(role: UserRole): boolean {
  return role === "OWNER" || role === "ADMIN"
}

/** OWNER/ADMIN may edit clinic data and operational settings. */
export function canManageClinicSettings(user: Pick<PermissionUser, "role">): boolean {
  return isOwnerOrAdmin(user.role)
}

/** OWNER/ADMIN may access the users tab. */
export function canManageUsers(user: Pick<PermissionUser, "role">): boolean {
  return isOwnerOrAdmin(user.role)
}

/**
 * Roles a given actor may assign when creating or editing a user.
 * - OWNER: any role.
 * - ADMIN: only RECEPTIONIST/PROFESSIONAL. ADMIN cannot create OWNER or other
 *   ADMINs — this keeps privilege escalation impossible for admins; promoting
 *   someone to ADMIN/OWNER is intentionally an OWNER-only action.
 */
export function assignableRoles(actorRole: UserRole): UserRole[] {
  if (actorRole === "OWNER") return ["OWNER", "ADMIN", "RECEPTIONIST", "PROFESSIONAL"]
  if (actorRole === "ADMIN") return ["RECEPTIONIST", "PROFESSIONAL"]
  return []
}

export function canCreateUserWithRole(actorRole: UserRole, newRole: UserRole): boolean {
  return assignableRoles(actorRole).includes(newRole)
}

/**
 * Whether `currentUser` may change `targetUser`'s role to `newRole`.
 * Rules: must be able to manage users; ADMIN can never touch an OWNER;
 * the resulting role must be within the actor's assignable set.
 */
export function canEditUserRole(
  currentUser: PermissionUser,
  targetUser: PermissionTargetUser,
  newRole: UserRole
): boolean {
  if (targetUser.clinicId !== currentUser.clinicId) return false
  if (!canManageUsers(currentUser)) return false
  // ADMIN cannot alter an OWNER at all.
  if (currentUser.role === "ADMIN" && targetUser.role === "OWNER") return false
  return canCreateUserWithRole(currentUser.role, newRole)
}

/**
 * Whether `currentUser` may edit (name/role) `targetUser` at all.
 * ADMIN cannot edit an OWNER; nobody edits across clinics.
 */
export function canEditUser(
  currentUser: PermissionUser,
  targetUser: PermissionTargetUser
): boolean {
  if (targetUser.clinicId !== currentUser.clinicId) return false
  if (!canManageUsers(currentUser)) return false
  if (currentUser.role === "ADMIN" && targetUser.role === "OWNER") return false
  return true
}

/**
 * Whether `currentUser` may deactivate `targetUser`. Callers must ALSO check
 * the "last active owner" rule separately (it needs a DB count) — this only
 * covers the actor/target-relationship rules: can't deactivate yourself,
 * ADMIN can't deactivate an OWNER, same-clinic only.
 */
export function canDeactivateUser(
  currentUser: PermissionUser,
  targetUser: PermissionTargetUser
): boolean {
  if (targetUser.clinicId !== currentUser.clinicId) return false
  if (!canManageUsers(currentUser)) return false
  if (currentUser.id === targetUser.id) return false
  if (currentUser.role === "ADMIN" && targetUser.role === "OWNER") return false
  return true
}

/** Whether the actor may reset another user's provisional password. */
export function canResetUserPassword(
  currentUser: PermissionUser,
  targetUser: PermissionTargetUser
): boolean {
  return canEditUser(currentUser, targetUser)
}

// ---------------------------------------------------------------------------
// Patients
// ---------------------------------------------------------------------------
//
// Per product decision: OWNER, ADMIN and RECEPTIONIST have identical patient
// permissions (create, edit basic data, toggle ACTIVE/INACTIVE, archive).
// PROFESSIONAL is view-only — they can look up a patient's basic info and
// administrative notes, but cannot create, edit, or change status/archive.
// There is no per-field lock (e.g. RECEPTIONIST editing "only basic data")
// in this V1 — that nuance can be added later if a real need shows up.

// Note: there is no `canViewPatients` helper — every authenticated role can
// view the patient list and details, so /pacientes and the detail page never
// gate on role for reads; only the mutation helpers below apply.

export function canCreatePatient(role: UserRole): boolean {
  return role !== "PROFESSIONAL"
}

export function canEditPatient(role: UserRole): boolean {
  return role !== "PROFESSIONAL"
}

export function canChangePatientStatus(role: UserRole): boolean {
  return role !== "PROFESSIONAL"
}

export function canArchivePatient(role: UserRole): boolean {
  return role !== "PROFESSIONAL"
}

// ---------------------------------------------------------------------------
// Professionals, working hours & professional↔service links
// ---------------------------------------------------------------------------
//
// Per product decision: OWNER, ADMIN and RECEPTIONIST have identical rights
// over the clinic's Professional/WorkingHour/ProfessionalService records —
// same rationale as Patients (RECEPTIONIST runs day-to-day registration work
// in a small clinic). PROFESSIONAL is view-only across this whole area,
// including their own record: they can see their schedule and linked
// services, but changing them is an administrative action in this V1.

export function canCreateProfessional(role: UserRole): boolean {
  return role !== "PROFESSIONAL"
}

export function canEditProfessional(role: UserRole): boolean {
  return role !== "PROFESSIONAL"
}

export function canChangeProfessionalStatus(role: UserRole): boolean {
  return role !== "PROFESSIONAL"
}

export function canManageWorkingHours(role: UserRole): boolean {
  return role !== "PROFESSIONAL"
}

export function canManageProfessionalServices(role: UserRole): boolean {
  return role !== "PROFESSIONAL"
}

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

export function canCreateService(role: UserRole): boolean {
  return role !== "PROFESSIONAL"
}

export function canEditService(role: UserRole): boolean {
  return role !== "PROFESSIONAL"
}

export function canChangeServiceStatus(role: UserRole): boolean {
  return role !== "PROFESSIONAL"
}
