/**
 * PURE Evolution webhook auth (Prompt 24). Validates the shared secret presented
 * by the Evolution server via either an `x-sinery-evolution-secret` header OR a
 * `?token=` query param (some Evolution configs can't send custom headers).
 * Timing-safe comparison. No env, no DB — unit-testable.
 *
 * NEVER logs or returns the expected/presented secret value.
 */
import { timingSafeEqual } from "node:crypto"

export const EVOLUTION_WEBHOOK_SECRET_HEADER = "x-sinery-evolution-secret"

/** Timing-safe string equality (length-safe). */
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8")
  const bb = Buffer.from(b, "utf8")
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

export interface WebhookAuthInput {
  /** EVOLUTION_WEBHOOK_SECRET (may be empty when not configured). */
  expectedSecret: string | null | undefined
  /** Value of the x-sinery-evolution-secret header, if any. */
  headerSecret: string | null | undefined
  /** Value of the ?token= query param, if any. */
  queryToken: string | null | undefined
}

export type WebhookAuthResult =
  | { ok: true; reason: "no_secret_configured" | "header_match" | "query_match" }
  | { ok: false; reason: "missing" | "mismatch" }

/**
 * Decides whether an Evolution webhook request is authorized.
 * - No expected secret configured → allowed (dev/local convenience).
 * - Expected secret set → the header OR query token must match (timing-safe).
 */
export function authorizeEvolutionWebhook(input: WebhookAuthInput): WebhookAuthResult {
  const expected = (input.expectedSecret ?? "").trim()
  if (expected.length === 0) return { ok: true, reason: "no_secret_configured" }

  const header = (input.headerSecret ?? "").trim()
  const query = (input.queryToken ?? "").trim()

  if (header.length === 0 && query.length === 0) return { ok: false, reason: "missing" }
  if (header.length > 0 && safeEqual(header, expected)) return { ok: true, reason: "header_match" }
  if (query.length > 0 && safeEqual(query, expected)) return { ok: true, reason: "query_match" }
  return { ok: false, reason: "mismatch" }
}
