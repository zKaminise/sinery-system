/** Password-reset tunables from env (with safe defaults). */

function intEnv(name: string, def: number): number {
  const v = Number(process.env[name])
  return Number.isFinite(v) && v > 0 ? v : def
}

export interface PasswordResetConfig {
  ttlMinutes: number
  maxAttempts: number
  codeLength: number
  resendCooldownSeconds: number
}

export function getPasswordResetConfig(): PasswordResetConfig {
  return {
    ttlMinutes: intEnv("PASSWORD_RESET_TOKEN_TTL_MINUTES", 10),
    maxAttempts: intEnv("PASSWORD_RESET_MAX_ATTEMPTS", 5),
    codeLength: intEnv("PASSWORD_RESET_CODE_LENGTH", 6),
    resendCooldownSeconds: intEnv("PASSWORD_RESET_RESEND_COOLDOWN_SECONDS", 60),
  }
}
