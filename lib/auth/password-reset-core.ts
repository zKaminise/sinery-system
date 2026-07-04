import { createHmac, randomInt, timingSafeEqual } from "node:crypto"

/**
 * Pure password-reset primitives (unit-testable). The 6-digit code is NEVER
 * stored in plaintext — only a keyed HMAC-SHA256 hash (deterministic, so we can
 * compare without a slow bcrypt round-trip while still not storing the code).
 */

/** Cryptographically-random numeric code (default 6 digits). */
export function generateResetCode(length = 6): string {
  let code = ""
  for (let i = 0; i < length; i++) code += randomInt(10).toString()
  return code
}

/** HMAC-SHA256(code, secret) → hex. `secret` is AUTH_SECRET on the server. */
export function hashResetCode(code: string, secret: string): string {
  return createHmac("sha256", secret).update(code).digest("hex")
}

/** Timing-safe verify of a code against a stored hash. */
export function verifyResetCode(code: string, storedHash: string, secret: string): boolean {
  const computed = hashResetCode(code, secret)
  const a = Buffer.from(computed, "utf8")
  const b = Buffer.from(storedHash, "utf8")
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export function isResetExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return now.getTime() > expiresAt.getTime()
}

export function attemptsExceeded(attempts: number, maxAttempts: number): boolean {
  return attempts >= maxAttempts
}

/** Seconds remaining before a new code can be requested (0 = allowed). */
export function resendCooldownRemaining(lastCreatedAt: Date | null, cooldownSeconds: number, now: Date = new Date()): number {
  if (!lastCreatedAt) return 0
  const elapsed = Math.floor((now.getTime() - lastCreatedAt.getTime()) / 1000)
  return Math.max(0, cooldownSeconds - elapsed)
}
