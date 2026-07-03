/**
 * Phone normalization for WhatsApp matching. WhatsApp `from` is digits-only
 * (e.g. "5534999990000"); clinic patients may store "+55 (34) 99999-0000".
 */

/** Strips everything but digits. Returns "" for empty/invalid input. */
export function normalizeWhatsAppPhone(raw: string | null | undefined): string {
  if (!raw) return ""
  return raw.replace(/\D/g, "")
}

/**
 * Compares two phone numbers by their significant trailing digits (default 8),
 * which is robust to country/area-code formatting differences. Both must have
 * at least `minDigits` digits to match.
 */
export function phonesMatch(a: string | null | undefined, b: string | null | undefined, minDigits = 8): boolean {
  const na = normalizeWhatsAppPhone(a)
  const nb = normalizeWhatsAppPhone(b)
  if (na.length < minDigits || nb.length < minDigits) return false
  const tailLen = Math.min(na.length, nb.length, 11)
  return na.slice(-tailLen) === nb.slice(-tailLen)
}

/** Masks a phone for logs/audit: keeps last 4 digits. */
export function maskPhone(raw: string | null | undefined): string {
  const n = normalizeWhatsAppPhone(raw)
  if (!n) return "—"
  if (n.length <= 4) return "••••"
  return `••••••${n.slice(-4)}`
}
