import "server-only"
import { Resend } from "resend"

/**
 * Lazily-constructed Resend client. The API key is read ONLY here (server), never
 * exported or logged. Returns null when no key is configured.
 */
let client: Resend | null = null

export function getResendClient(): Resend | null {
  const key = (process.env.RESEND_API_KEY ?? "").trim()
  if (!key) return null
  if (!client) client = new Resend(key)
  return client
}
