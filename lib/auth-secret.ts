/**
 * AUTH_SECRET validation (pure — no server-only, so it's unit-testable).
 *
 * In development we only require the secret to exist. In PRODUCTION we also
 * refuse well-known placeholder values and secrets that are too short, so the
 * app can never boot with a guessable JWT signing key (which would allow
 * session forgery). See lib/session.ts.
 */

/** Known placeholder/example values that must never be used in production. */
export const PLACEHOLDER_AUTH_SECRETS = new Set([
  "change-me-in-development",
  "change-me",
  "changeme",
  "secret",
  "your-secret-here",
  "development",
])

/** Minimum length enforced in production (e.g. `openssl rand -base64 32`). */
export const MIN_AUTH_SECRET_LENGTH = 32

export interface AuthSecretCheck {
  ok: boolean
  error?: string
}

const MISSING_SECRET_ERROR =
  'AUTH_SECRET não está configurado. Copie ".env.example" para ".env" e defina AUTH_SECRET (ex: rode "openssl rand -base64 32" e cole o resultado).'

export function validateAuthSecret(
  secret: string | undefined,
  isProduction: boolean
): AuthSecretCheck {
  if (!secret) {
    return { ok: false, error: MISSING_SECRET_ERROR }
  }

  if (isProduction) {
    if (PLACEHOLDER_AUTH_SECRETS.has(secret.trim().toLowerCase())) {
      return {
        ok: false,
        error:
          "AUTH_SECRET está com um valor placeholder em produção. Gere um segredo real com \"openssl rand -base64 32\".",
      }
    }
    if (secret.length < MIN_AUTH_SECRET_LENGTH) {
      return {
        ok: false,
        error: `AUTH_SECRET é curto demais para produção (mínimo ${MIN_AUTH_SECRET_LENGTH} caracteres). Gere um segredo real com "openssl rand -base64 32".`,
      }
    }
  }

  return { ok: true }
}
