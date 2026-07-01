import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * True for the internal error Next.js throws from dynamic APIs (`cookies()`,
 * `headers()`, etc.) to bail a route out of static generation. Callers that
 * wrap those APIs in a try/catch for their own error handling (e.g. a
 * "safe" DB-lookup wrapper) must re-throw this instead of swallowing it, or
 * the route silently loses its dynamic-rendering opt-in during `next build`.
 */
export function isDynamicServerUsageError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    (error as { digest?: unknown }).digest === "DYNAMIC_SERVER_USAGE"
  )
}
