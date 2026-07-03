import { createHmac, timingSafeEqual } from "node:crypto"

/**
 * Parses an `X-Hub-Signature-256` header ("sha256=<hex>") → the hex hash, or
 * null if the header is missing/malformed.
 */
export function parseSignatureHeader(header: string | null | undefined): string | null {
  if (!header) return null
  const trimmed = header.trim()
  const match = /^sha256=([a-f0-9]{64})$/i.exec(trimmed)
  return match ? match[1].toLowerCase() : null
}

/**
 * Verifies Meta's webhook signature: HMAC-SHA256 of the RAW body using the app
 * secret, compared to the header in constant time. Returns false when the
 * header is missing/malformed or the app secret is empty.
 */
export function verifyWhatsAppSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  appSecret: string
): boolean {
  const provided = parseSignatureHeader(signatureHeader)
  if (!provided || !appSecret) return false

  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex")

  // Constant-time compare (both are fixed 64-char hex here, but be safe).
  const a = Buffer.from(provided, "hex")
  const b = Buffer.from(expected, "hex")
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
