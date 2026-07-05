import "server-only"

import { prisma } from "@/lib/prisma"
import { hashPassword, verifyPassword, DUMMY_PASSWORD_HASH } from "@/lib/password"
import {
  createSessionCookie,
  clearSessionCookie,
  getSessionFromCookies,
} from "@/lib/session"
import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"
import { resolveLoginClinicScope, loginErrorFor } from "@/lib/tenant/tenant-security"
import type { TenantResolution } from "@/lib/platform/tenant-resolver"

export interface AuthResult {
  success: boolean
  error?: string
}

/**
 * Verifies credentials, creates the session cookie, and logs the attempt.
 *
 * Multi-tenant subdomain scoping (Prompt 27): when the request host resolves to
 * a specific clinic (e.g. `clinica-teste.hml.app.sinery.com.br`), the user
 * lookup is scoped to that clinic's id — so a clinic-A user can NEVER log into
 * clinic-B's subdomain, even with the correct password (the email won't match
 * a member of clinic B → generic denial). At the root/app host (or in local
 * dev), `hostTenant` is not a clinic, so lookup falls back to e-mail alone
 * (unchanged legacy behavior — keeps HML working before wildcard DNS is live).
 * Errors stay generic and existence-hiding. See docs/domains-and-dns.md.
 */
export async function login(
  emailInput: string,
  password: string,
  hostTenant?: TenantResolution | null
): Promise<AuthResult> {
  const email = emailInput.trim().toLowerCase()
  const genericError = loginErrorFor(hostTenant)

  // If the host is a clinic subdomain, scope the lookup to that clinic's id.
  // If that slug doesn't map to a real clinic, there is no login here at all.
  const scopeSlug = hostTenant ? resolveLoginClinicScope(hostTenant) : null
  let scopedClinicId: string | null = null
  if (scopeSlug) {
    const clinic = await prisma.clinic.findUnique({
      where: { slug: scopeSlug },
      select: { id: true },
    })
    if (!clinic) {
      // Keep the timing constant (still hash-compare) and never reveal that the
      // clinic/host is unknown.
      await verifyPassword(password, DUMMY_PASSWORD_HASH)
      await createAuditLog({
        clinicId: null,
        userId: null,
        action: AuditAction.AUTH_LOGIN_FAILED,
        entity: "User",
        entityId: null,
        description: "Tentativa de login falhou (endereço de clínica desconhecido).",
        metadata: { email, hostSlug: scopeSlug, reason: "clinic_not_found" },
      })
      return { success: false, error: genericError }
    }
    scopedClinicId = clinic.id
  }

  const user = await prisma.user.findFirst({
    where: scopedClinicId ? { email, clinicId: scopedClinicId } : { email },
    include: { clinic: true },
  })

  // Always run the comparison, even with no user/hash, so response timing
  // doesn't reveal whether the e-mail exists.
  const isPasswordValid = await verifyPassword(
    password,
    user?.passwordHash ?? DUMMY_PASSWORD_HASH
  )

  const isAllowed =
    !!user &&
    !!user.passwordHash &&
    isPasswordValid &&
    user.status === "ACTIVE" &&
    user.clinic.status === "ACTIVE"

  if (!isAllowed) {
    await createAuditLog({
      clinicId: user?.clinicId ?? scopedClinicId ?? null,
      userId: user?.id ?? null,
      action: AuditAction.AUTH_LOGIN_FAILED,
      entity: "User",
      entityId: user?.id ?? null,
      description: "Tentativa de login falhou.",
      metadata: { email, hostSlug: scopeSlug ?? undefined },
    })
    return { success: false, error: genericError }
  }

  await createSessionCookie({
    userId: user.id,
    clinicId: user.clinicId,
    role: user.role,
    slug: user.clinic.slug,
  })

  if (!user.firstLoginAt) {
    await prisma.user.update({
      where: { id: user.id },
      data: { firstLoginAt: new Date() },
    })
  }

  await createAuditLog({
    clinicId: user.clinicId,
    userId: user.id,
    action: AuditAction.AUTH_LOGIN_SUCCESS,
    entity: "User",
    entityId: user.id,
    description: `Usuário ${user.name} realizou login.`,
  })

  return { success: true }
}

export async function logout(): Promise<void> {
  const session = await getSessionFromCookies()

  await clearSessionCookie()

  if (session) {
    await createAuditLog({
      clinicId: session.clinicId,
      userId: session.userId,
      action: AuditAction.AUTH_LOGOUT,
      entity: "User",
      entityId: session.userId,
      description: "Usuário realizou logout.",
    })
  }
}

export async function changePassword(newPassword: string): Promise<AuthResult> {
  const session = await getSessionFromCookies()
  if (!session) {
    return { success: false, error: "Sessão expirada. Faça login novamente." }
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } })
  if (!user) {
    return { success: false, error: "Sessão inválida." }
  }

  const passwordHash = await hashPassword(newPassword)
  const wasTemporary = user.temporaryPassword

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      temporaryPassword: false,
      passwordChangedAt: new Date(),
    },
  })

  await createAuditLog({
    clinicId: user.clinicId,
    userId: user.id,
    action: AuditAction.AUTH_PASSWORD_CHANGED,
    entity: "User",
    entityId: user.id,
    description: `Usuário ${user.name} alterou a senha${wasTemporary ? " provisória" : ""}.`,
  })

  return { success: true }
}
