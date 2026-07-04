import "server-only"

import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { getEmailConfig, shouldSendReal } from "@/lib/email/email-config"
import { getResendClient } from "@/lib/email/resend-client"
import { sanitizeEmailError, maskEmail } from "@/lib/email/email-sanitize"
import type { EmailType } from "@/lib/generated/prisma/client"

export interface SendTransactionalEmailInput {
  clinicId?: string | null
  userId?: string | null
  platformUserId?: string | null
  to: string
  subject: string
  html: string
  text?: string
  type: EmailType
  /** SAFE metadata only — never the reset code / provisional password. */
  metadata?: Record<string, unknown> | null
  replyTo?: string
}

export interface SendTransactionalEmailResult {
  ok: boolean
  status: "MOCKED" | "SENT" | "FAILED"
  emailLogId: string
  providerMessageId?: string
}

/**
 * Sends a transactional email via Resend (or records it as MOCKED). Always
 * writes an EmailLog and never throws — a failed email must not break the caller
 * (e.g. clinic provisioning still succeeds if the welcome email fails).
 */
export async function sendTransactionalEmail(
  input: SendTransactionalEmailInput
): Promise<SendTransactionalEmailResult> {
  const cfg = getEmailConfig()
  const from = cfg.fromEmail
  const replyTo = input.replyTo || cfg.replyToEmail
  const real = shouldSendReal(cfg)

  const log = await prisma.emailLog.create({
    data: {
      clinicId: input.clinicId ?? null,
      userId: input.userId ?? null,
      platformUserId: input.platformUserId ?? null,
      toEmail: input.to,
      fromEmail: from,
      replyToEmail: replyTo,
      subject: input.subject,
      type: input.type,
      status: "PENDING",
      provider: real ? "RESEND" : "MOCK",
      metadata: (input.metadata ?? undefined) as object | undefined,
    },
  })

  // Mock mode: nothing is sent.
  if (!real) {
    if (process.env.NODE_ENV !== "production") {
      logger.info("E-mail (MOCKED — não enviado)", {
        context: "email",
        metadata: { to: maskEmail(input.to), type: input.type, subject: input.subject },
      })
    }
    await prisma.emailLog.update({ where: { id: log.id }, data: { status: "MOCKED", sentAt: new Date() } })
    return { ok: true, status: "MOCKED", emailLogId: log.id }
  }

  // Real send via Resend.
  try {
    const resend = getResendClient()
    if (!resend) throw new Error("Resend não configurado (RESEND_API_KEY ausente).")
    const result = await resend.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text ?? input.subject,
      replyTo,
    })
    if (result.error) throw new Error(result.error.message)
    const providerMessageId = result.data?.id
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: "SENT", providerMessageId, sentAt: new Date() },
    })
    return { ok: true, status: "SENT", emailLogId: log.id, providerMessageId }
  } catch (error) {
    const message = sanitizeEmailError(error)
    logger.error("Falha ao enviar e-mail transacional", {
      context: "email",
      metadata: { to: maskEmail(input.to), type: input.type, error: message },
    })
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: "FAILED", errorMessage: message, failedAt: new Date() },
    })
    return { ok: false, status: "FAILED", emailLogId: log.id }
  }
}
