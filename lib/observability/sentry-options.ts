import type { ErrorEvent } from "@sentry/nextjs"

/**
 * Strips request cookies and auth headers from every event before it leaves
 * the process, so no session token, cookie, or Authorization header is ever
 * sent to Sentry. `sendDefaultPii` is also forced off in the init options.
 */
function scrubSensitiveData(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    delete event.request.cookies
    if (event.request.headers) {
      for (const key of Object.keys(event.request.headers)) {
        const lower = key.toLowerCase()
        if (lower === "cookie" || lower === "authorization") {
          delete event.request.headers[key]
        }
      }
    }
  }
  return event
}

/**
 * Shared Sentry.init options for both server (instrumentation.ts) and client
 * (instrumentation-client.ts). Returns null when no DSN is provided, so the
 * caller can skip init entirely and the app runs normally without Sentry.
 */
export function buildSentryOptions(dsn: string | undefined) {
  if (!dsn) return null

  return {
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    // Conservative default sampling; tune per-env once volume is known.
    tracesSampleRate: 0.1,
    // Never attach cookies, IPs, or user headers automatically.
    sendDefaultPii: false,
    beforeSend: scrubSensitiveData,
  }
}
