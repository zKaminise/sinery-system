/** Sanitizes Asaas errors so the API key / access token never reaches logs. */
export function sanitizeAsaasError(error: unknown): string {
  let msg = error instanceof Error ? error.message : String(error ?? "unknown error")
  msg = msg
    .replace(/\$aact_[A-Za-z0-9._=-]+/g, "[redacted]")
    .replace(/access_token["'\s:]+[A-Za-z0-9$._=-]+/gi, "access_token [redacted]")
  return msg.slice(0, 300)
}
