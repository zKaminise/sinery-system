import "server-only"

import { prisma } from "@/lib/prisma"
import { hashPassword, verifyPassword, DUMMY_PASSWORD_HASH } from "@/lib/password"
import {
  createSessionCookie,
  clearSessionCookie,
  getSessionFromCookies,
} from "@/lib/session"
import { createAuditLog } from "@/lib/audit"

const GENERIC_LOGIN_ERROR = "E-mail ou senha inválidos."

export interface AuthResult {
  success: boolean
  error?: string
}

/**
 * Verifies credentials, creates the session cookie, and logs the attempt.
 * Login is looked up by e-mail alone (not clinic-scoped): this MVP has no
 * subdomain/tenant selection step on the login screen yet, so it relies on
 * User.email being unique in practice across the single seeded clinic. See
 * docs/authentication.md for the multi-tenant login limitation.
 */
export async function login(emailInput: string, password: string): Promise<AuthResult> {
  const email = emailInput.trim().toLowerCase()

  const user = await prisma.user.findFirst({
    where: { email },
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
      clinicId: user?.clinicId ?? null,
      userId: user?.id ?? null,
      action: "AUTH_LOGIN_FAILED",
      entity: "User",
      entityId: user?.id ?? null,
      description: "Tentativa de login falhou.",
      metadata: { email },
    })
    return { success: false, error: GENERIC_LOGIN_ERROR }
  }

  await createSessionCookie({
    userId: user.id,
    clinicId: user.clinicId,
    role: user.role,
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
    action: "AUTH_LOGIN_SUCCESS",
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
      action: "AUTH_LOGOUT",
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
    action: "AUTH_PASSWORD_CHANGED",
    entity: "User",
    entityId: user.id,
    description: `Usuário ${user.name} alterou a senha${wasTemporary ? " provisória" : ""}.`,
  })

  return { success: true }
}
