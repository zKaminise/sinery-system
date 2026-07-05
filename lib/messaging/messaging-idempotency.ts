/**
 * PURE idempotency hashing for messaging webhooks (Prompt 24). The hash is
 * derived only from non-sensitive identifiers (provider + instance + external
 * message id) — NEVER from the API key, webhook secret, or full payload. Same
 * event → same hash (dedupe); different event → different hash. Unit-testable.
 */
import { createHash } from "node:crypto"

/** Stable idempotency key for an inbound messaging event. */
export function buildMessagingEventHash(parts: {
  provider: string
  instanceName?: string | null
  externalMessageId?: string | null
  fromPhone?: string | null
}): string {
  const key = [
    parts.provider,
    parts.instanceName ?? "",
    parts.externalMessageId ?? "",
    parts.fromPhone ?? "",
  ].join("|")
  return createHash("sha256").update(key).digest("hex")
}
