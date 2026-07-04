/**
 * Sanitizes provider errors and masks PII so nothing sensitive reaches logs or
 * EmailLog.errorMessage. Pure — unit-testable.
 */

/** Strips API keys / bearer tokens and truncates. */
export function sanitizeEmailError(error: unknown): string {
  let msg = error instanceof Error ? error.message : String(error ?? "unknown error")
  msg = msg
    .replace(/re_[A-Za-z0-9_-]{8,}/g, "[redacted]") // Resend keys
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/\$aact_[A-Za-z0-9._=-]+/g, "[redacted]") // Asaas keys
  return msg.slice(0, 300)
}

/** Masks an email for logs: "ana@x.com" → "an***@x.com". */
export function maskEmail(email: string): string {
  const [local, domain] = String(email ?? "").split("@")
  if (!domain) return "[email]"
  const shown = local.slice(0, 2)
  return `${shown}${"*".repeat(Math.max(1, local.length - shown.length))}@${domain}`
}
