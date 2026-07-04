import "server-only"

import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { hashPassword } from "@/lib/password"
import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"
import { sendTransactionalEmail } from "@/lib/email/email-service"
import { passwordResetCodeEmail } from "@/lib/email/email-templates"
import { getPasswordResetConfig } from "@/lib/auth/password-reset-config"
import {
  generateResetCode,
  hashResetCode,
  verifyResetCode,
  isResetExpired,
  attemptsExceeded,
  resendCooldownRemaining,
} from "@/lib/auth/password-reset-core"

function authSecret(): string {
  return process.env.AUTH_SECRET ?? ""
}

interface ResetTarget {
  kind: "user" | "platform"
  id: string
  clinicId?: string | null
}

/**
 * Finds the reset target for an email. Clinic Users take precedence over
 * PlatformUsers (a clinic email that's also a founder resets the clinic user —
 * documented edge case). Only ACTIVE accounts. Never reveals which (or if any).
 */
async function findResetTarget(email: string): Promise<ResetTarget | null> {
  const user = await prisma.user.findFirst({
    where: { email, status: "ACTIVE" },
    select: { id: true, clinicId: true },
  })
  if (user) return { kind: "user", id: user.id, clinicId: user.clinicId }

  const platform = await prisma.platformUser.findUnique({ where: { email } })
  if (platform && platform.status === "ACTIVE") return { kind: "platform", id: platform.id }

  return null
}

/**
 * Requests a password reset. ALWAYS resolves generically (never reveals whether
 * the email exists). If a target is found and not within the resend cooldown,
 * generates a code, stores only its hash, and sends the email.
 */
export async function requestPasswordReset(input: {
  email: string
  ipAddress?: string | null
  userAgent?: string | null
}): Promise<{ ok: true }> {
  const cfg = getPasswordResetConfig()
  const email = input.email.trim().toLowerCase()
  const target = await findResetTarget(email)
  if (!target) return { ok: true }

  // Resend cooldown (anti-spam): if a code was sent very recently, skip silently.
  const recent = await prisma.passwordResetToken.findFirst({
    where: { email },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  })
  if (recent && resendCooldownRemaining(recent.createdAt, cfg.resendCooldownSeconds) > 0) {
    return { ok: true }
  }

  // Invalidate any outstanding codes before issuing a new one.
  await prisma.passwordResetToken.updateMany({ where: { email, usedAt: null }, data: { usedAt: new Date() } })

  const code = generateResetCode(cfg.codeLength)
  const tokenHash = hashResetCode(code, authSecret())

  await prisma.passwordResetToken.create({
    data: {
      email,
      tokenHash,
      expiresAt: new Date(Date.now() + cfg.ttlMinutes * 60_000),
      maxAttempts: cfg.maxAttempts,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      userId: target.kind === "user" ? target.id : null,
      platformUserId: target.kind === "platform" ? target.id : null,
    },
  })

  // Dev-only visibility (never in production). The code is NEVER in EmailLog/audit metadata.
  if (process.env.NODE_ENV !== "production") {
    logger.info("[dev] código de recuperação gerado", { context: "auth.reset", metadata: { email, code } })
  }

  const tpl = passwordResetCodeEmail({ code, ttlMinutes: cfg.ttlMinutes })
  await sendTransactionalEmail({
    to: email,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
    type: "PASSWORD_RESET_CODE",
    userId: target.kind === "user" ? target.id : null,
    platformUserId: target.kind === "platform" ? target.id : null,
    clinicId: target.kind === "user" ? target.clinicId : null,
    metadata: { ttlMinutes: cfg.ttlMinutes }, // no code here
  })

  await createAuditLog({
    clinicId: target.kind === "user" ? target.clinicId : null,
    userId: target.kind === "user" ? target.id : null,
    action: AuditAction.AUTH_PASSWORD_RESET_REQUESTED,
    entity: target.kind === "user" ? "User" : "PlatformUser",
    entityId: target.id,
    description: "Recuperação de senha solicitada.",
  })

  return { ok: true }
}

export type VerifyResetStatus = "ok" | "invalid" | "expired" | "locked"

/** Checks a code without consuming it (UX gate). Increments attempts on a wrong code. */
export async function verifyResetCodeForEmail(input: { email: string; code: string }): Promise<{ status: VerifyResetStatus }> {
  const email = input.email.trim().toLowerCase()
  const token = await prisma.passwordResetToken.findFirst({ where: { email, usedAt: null }, orderBy: { createdAt: "desc" } })
  if (!token) return { status: "invalid" }
  if (isResetExpired(token.expiresAt)) return { status: "expired" }
  if (attemptsExceeded(token.attempts, token.maxAttempts)) return { status: "locked" }
  if (!verifyResetCode(input.code, token.tokenHash, authSecret())) {
    await prisma.passwordResetToken.update({ where: { id: token.id }, data: { attempts: { increment: 1 } } })
    return { status: "invalid" }
  }
  return { status: "ok" }
}

/** Verifies the code and sets the new password (single use). */
export async function resetPasswordWithCode(input: {
  email: string
  code: string
  newPassword: string
}): Promise<{ ok: boolean; error?: string }> {
  const email = input.email.trim().toLowerCase()
  const token = await prisma.passwordResetToken.findFirst({ where: { email, usedAt: null }, orderBy: { createdAt: "desc" } })
  if (!token) return { ok: false, error: "Código inválido ou já utilizado. Solicite um novo." }
  if (isResetExpired(token.expiresAt)) return { ok: false, error: "Código expirado. Solicite um novo." }
  if (attemptsExceeded(token.attempts, token.maxAttempts)) return { ok: false, error: "Muitas tentativas. Solicite um novo código." }
  if (!verifyResetCode(input.code, token.tokenHash, authSecret())) {
    await prisma.passwordResetToken.update({ where: { id: token.id }, data: { attempts: { increment: 1 } } })
    return { ok: false, error: "Código incorreto." }
  }

  const passwordHash = await hashPassword(input.newPassword)
  const now = new Date()

  if (token.userId) {
    const user = await prisma.user.findUnique({ where: { id: token.userId }, select: { id: true, clinicId: true, status: true } })
    if (!user || user.status !== "ACTIVE") return { ok: false, error: "Conta indisponível." }
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash, temporaryPassword: false, passwordChangedAt: now } })
    await createAuditLog({ clinicId: user.clinicId, userId: user.id, action: AuditAction.AUTH_PASSWORD_RESET_COMPLETED, entity: "User", entityId: user.id, description: "Senha redefinida via recuperação." })
  } else if (token.platformUserId) {
    const pu = await prisma.platformUser.findUnique({ where: { id: token.platformUserId }, select: { id: true, status: true } })
    if (!pu || pu.status !== "ACTIVE") return { ok: false, error: "Conta indisponível." }
    await prisma.platformUser.update({ where: { id: pu.id }, data: { passwordHash, temporaryPassword: false, passwordChangedAt: now } })
    await createAuditLog({ action: AuditAction.AUTH_PASSWORD_RESET_COMPLETED, entity: "PlatformUser", entityId: pu.id, description: "Senha de plataforma redefinida via recuperação." })
  } else {
    return { ok: false, error: "Token inválido." }
  }

  // Single use + invalidate any siblings.
  await prisma.passwordResetToken.update({ where: { id: token.id }, data: { usedAt: now } })
  await prisma.passwordResetToken.updateMany({ where: { email, usedAt: null }, data: { usedAt: now } })
  return { ok: true }
}
