/**
 * PURE decision for Meta's GET verification handshake. The route handles the
 * `WHATSAPP_WEBHOOK_ENABLED` gate + returns the raw challenge; this only checks
 * mode/token/challenge so it is unit-testable.
 */
export interface WebhookVerificationInput {
  mode: string | null
  token: string | null
  challenge: string | null
  expectedToken: string
}

export type WebhookVerificationResult =
  | { ok: true; challenge: string }
  | { ok: false; status: 400 | 403; reason: string }

export function checkWebhookVerification(input: WebhookVerificationInput): WebhookVerificationResult {
  if (input.mode !== "subscribe") {
    return { ok: false, status: 400, reason: "invalid_mode" }
  }
  if (!input.challenge) {
    return { ok: false, status: 400, reason: "missing_challenge" }
  }
  // Reject if no expected token is configured OR it doesn't match.
  if (!input.expectedToken || input.token !== input.expectedToken) {
    return { ok: false, status: 403, reason: "invalid_verify_token" }
  }
  return { ok: true, challenge: input.challenge }
}
