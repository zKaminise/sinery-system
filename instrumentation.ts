import * as Sentry from "@sentry/nextjs"

import { buildSentryOptions } from "@/lib/observability/sentry-options"

/**
 * Runs once per server/edge instance. Initializes Sentry only when a DSN is
 * configured — with no SENTRY_DSN the app runs completely normally and no
 * Sentry code path is exercised.
 */
export async function register() {
  const options = buildSentryOptions(
    process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
  )
  if (options) {
    Sentry.init(options)
  }
}

// Forwards server-side request errors (Server Components, Route Handlers,
// Server Actions) to Sentry. Safe no-op when Sentry wasn't initialized.
export const onRequestError = Sentry.captureRequestError
