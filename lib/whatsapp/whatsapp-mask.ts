/**
 * Masking helpers for the WhatsApp integration UI. Secrets (access token, app
 * secret, verify token) are NEVER shown — only "Configurado"/"Não configurado".
 * Non-sensitive ids may be shown partially.
 */

/** For secrets: only reveals whether a value exists, never the value. */
export function maskWhatsAppSecret(value: string | null | undefined): string {
  return value && value.trim().length > 0 ? "Configurado" : "Não configurado"
}

/** For non-sensitive ids (phoneNumberId, businessAccountId): partial reveal. */
export function maskWhatsAppId(value: string | null | undefined): string {
  const v = (value ?? "").trim()
  if (!v) return "Não configurado"
  if (v.length <= 4) return "••••"
  return `••••••${v.slice(-4)}`
}
