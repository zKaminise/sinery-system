import * as Sentry from "@sentry/nextjs"

export type LogLevel = "debug" | "info" | "warn" | "error"

export interface LogOptions {
  /** Short subsystem tag, e.g. "health", "audit", "auth". */
  context?: string
  /** Any structured data. Sensitive keys are redacted automatically. */
  metadata?: Record<string, unknown>
  /** The error object, for `logger.error`. Never serialized to Sentry raw. */
  error?: unknown
}

/**
 * Substrings (case-insensitive) that mark a field as sensitive. Any matching
 * key in logged metadata is replaced with "[REDACTED]" before it reaches the
 * console or Sentry. This is defense-in-depth — callers still shouldn't pass
 * secrets, but a stray one won't leak.
 */
const SENSITIVE_KEY_PATTERNS = [
  "password",
  "passwordhash",
  "token",
  "secret",
  "cookie",
  "authorization",
  "auth_secret",
  "apikey",
  "api_key",
  "creditcard",
  "cardnumber",
]

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase()
  return SENSITIVE_KEY_PATTERNS.some((pattern) => normalized.includes(pattern))
}

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== "object") return value

  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1))
  }

  const out: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    out[key] = isSensitiveKey(key) ? "[REDACTED]" : redact(val, depth + 1)
  }
  return out
}

function serializeError(error: unknown): Record<string, unknown> | undefined {
  if (!error) return undefined
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      // Stack is kept only for local/server logs, never sent to the client.
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    }
  }
  return { value: String(error) }
}

const isDev = process.env.NODE_ENV === "development"

function emit(level: LogLevel, message: string, options?: LogOptions) {
  const context = options?.context
  const metadata = options?.metadata
    ? (redact(options.metadata) as Record<string, unknown>)
    : undefined
  const errorInfo = serializeError(options?.error)

  if (isDev) {
    // Human-readable in development.
    const tag = context ? `[${level.toUpperCase()}][${context}]` : `[${level.toUpperCase()}]`
    const extras: unknown[] = []
    if (metadata) extras.push(metadata)
    if (errorInfo) extras.push(errorInfo)
    console[level === "debug" ? "log" : level](`${tag} ${message}`, ...extras)
  } else {
    // Structured JSON in production for log aggregation.
    const entry = {
      level,
      message,
      context,
      timestamp: new Date().toISOString(),
      ...(metadata ? { metadata } : {}),
      ...(errorInfo ? { error: errorInfo } : {}),
    }
    console[level === "debug" ? "log" : level](JSON.stringify(entry))
  }

  // Forward errors (and their originating exception) to Sentry when it's
  // initialized. Calls are safe no-ops when SENTRY_DSN is unset.
  if (level === "error") {
    if (options?.error instanceof Error) {
      Sentry.captureException(options.error, {
        tags: context ? { context } : undefined,
        extra: metadata,
      })
    } else {
      Sentry.captureMessage(message, {
        level: "error",
        tags: context ? { context } : undefined,
        extra: metadata,
      })
    }
  }
}

export const logger = {
  debug: (message: string, options?: LogOptions) => emit("debug", message, options),
  info: (message: string, options?: LogOptions) => emit("info", message, options),
  warn: (message: string, options?: LogOptions) => emit("warn", message, options),
  error: (message: string, options?: LogOptions) => emit("error", message, options),
}
