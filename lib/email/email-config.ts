/**
 * Email (Resend) configuration reader. Plain module (no server-only) so the
 * mock-mode decision is unit-testable — but the actual RESEND_API_KEY is only
 * ever read inside the server-only client, never exposed here.
 */

export interface EmailConfig {
  /** When true, nothing is sent — the EmailLog is written as MOCKED. */
  mockMode: boolean
  /** Presence only — never the key value. */
  hasApiKey: boolean
  fromEmail: string
  replyToEmail: string
  contactToEmail: string
}

const DEFAULT_FROM = "Sinery <no-reply@sinery.com.br>"
const DEFAULT_REPLY_TO = "kaminise@sinery.com.br"

export function getEmailConfig(): EmailConfig {
  // Mock by default (only "false" turns it off) so nothing is ever sent by accident.
  const mockMode = (process.env.EMAIL_MOCK_MODE ?? "true").toLowerCase() !== "false"
  return {
    mockMode,
    hasApiKey: Boolean((process.env.RESEND_API_KEY ?? "").trim()),
    fromEmail: (process.env.RESEND_FROM_EMAIL ?? "").trim() || DEFAULT_FROM,
    replyToEmail: (process.env.RESEND_REPLY_TO_EMAIL ?? "").trim() || DEFAULT_REPLY_TO,
    contactToEmail: (process.env.RESEND_CONTACT_TO_EMAIL ?? "").trim() || DEFAULT_REPLY_TO,
  }
}

/**
 * Whether a real send should be attempted. Real send requires mockMode off AND
 * an API key present — otherwise we fall back to MOCKED (never crash).
 */
export function shouldSendReal(config: EmailConfig = getEmailConfig()): boolean {
  return !config.mockMode && config.hasApiKey
}
