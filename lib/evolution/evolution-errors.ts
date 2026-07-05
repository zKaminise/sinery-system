/**
 * PURE error sanitization for Evolution API (Prompt 24). Ensures NO secret
 * (apikey / webhook secret / token) ever reaches logs, audit metadata, or a
 * client response. No env, no DB — unit-testable.
 */

const SECRET_HINT = /(apikey|api_key|authorization|token|secret|bearer)\s*[:=]\s*\S+/gi

/** A short, safe error message. Strips key/token-looking fragments + truncates. */
export function sanitizeEvolutionError(error: unknown, max = 300): string {
  let message: string
  if (error instanceof Error) message = error.message
  else if (typeof error === "string") message = error
  else {
    try {
      message = JSON.stringify(error)
    } catch {
      message = "unknown_error"
    }
  }
  return message.replace(SECRET_HINT, "$1=***").slice(0, max)
}

/** Maps a transport failure to a stable, non-sensitive error code. */
export function evolutionErrorCode(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "AbortError") return "timeout"
    if (/fetch failed|ECONNREFUSED|ENOTFOUND|network/i.test(error.message)) return "network_error"
  }
  return "evolution_api_error"
}

/** Friendly message shown to a human operator when a send fails. */
export const EVOLUTION_SEND_FRIENDLY_ERROR =
  "Não foi possível enviar a mensagem pela Evolution API agora. Tente novamente em instantes."
