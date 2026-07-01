import * as Sentry from "@sentry/nextjs"

import { buildSentryOptions } from "@/lib/observability/sentry-options"

// Initializes client-side Sentry only when NEXT_PUBLIC_SENTRY_DSN is set.
// Without it, this is a no-op and the app runs normally.
try {
  const options = buildSentryOptions(process.env.NEXT_PUBLIC_SENTRY_DSN)
  if (options) {
    Sentry.init(options)
  }
} catch {
  // Never let instrumentation setup break the app boot.
}

// Captures navigation errors for Sentry's routing instrumentation.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
