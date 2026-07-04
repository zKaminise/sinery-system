import "server-only"

import { prisma } from "@/lib/prisma"
import { hashPassword, verifyPassword, DUMMY_PASSWORD_HASH } from "@/lib/password"
import {
  createPlatformSessionCookie,
  clearPlatformSessionCookie,
  getPlatformSessionFromCookies,
} from "@/lib/platform/platform-session"
import { createPlatformAuditLog, PlatformAuditAction } from "@/lib/platform/platform-audit"

const GENERIC_LOGIN_ERROR = "E-mail ou senha inválidos."

export interface PlatformAuthResult {
  success: boolean
  error?: string
}

/** Authenticates a PlatformUser and creates the platform session cookie. */
export async function loginPlatform(emailInput: string, password: string): Promise<PlatformAuthResult> {
  const email = emailInput.trim().toLowerCase()

  const user = await prisma.platformUser.findUnique({ where: { email } })

  // Timing-safe: always run a comparison.
  const isPasswordValid = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH)

  const isAllowed = !!user && isPasswordValid && user.status === "ACTIVE"

  if (!isAllowed) {
    await createPlatformAuditLog({
      platformUserId: user?.id ?? null,
      action: PlatformAuditAction.LOGIN_FAILED,
      targetType: "PlatformUser",
      targetId: user?.id ?? null,
      metadata: { email },
    })
    return { success: false, error: GENERIC_LOGIN_ERROR }
  }

  await createPlatformSessionCookie({ platformUserId: user.id, role: user.role })
  await prisma.platformUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })

  await createPlatformAuditLog({
    platformUserId: user.id,
    action: PlatformAuditAction.LOGIN_SUCCESS,
    targetType: "PlatformUser",
    targetId: user.id,
  })

  return { success: true }
}

export async function logoutPlatform(): Promise<void> {
  const session = await getPlatformSessionFromCookies()
  await clearPlatformSessionCookie()
  if (session) {
    await createPlatformAuditLog({
      platformUserId: session.platformUserId,
      action: PlatformAuditAction.LOGOUT,
      targetType: "PlatformUser",
      targetId: session.platformUserId,
    })
  }
}

export async function changePlatformPassword(newPassword: string): Promise<PlatformAuthResult> {
  const session = await getPlatformSessionFromCookies()
  if (!session) return { success: false, error: "Sessão expirada. Faça login novamente." }

  const user = await prisma.platformUser.findUnique({ where: { id: session.platformUserId } })
  if (!user) return { success: false, error: "Sessão inválida." }

  const passwordHash = await hashPassword(newPassword)
  await prisma.platformUser.update({
    where: { id: user.id },
    data: { passwordHash, temporaryPassword: false, passwordChangedAt: new Date() },
  })

  await createPlatformAuditLog({
    platformUserId: user.id,
    action: PlatformAuditAction.PASSWORD_CHANGED,
    targetType: "PlatformUser",
    targetId: user.id,
  })

  return { success: true }
}
