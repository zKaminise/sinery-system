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

/**
 * Formats a Service.priceInCents value as Brazilian currency (e.g. 15000 ->
 * "R$ 150,00"). Returns a friendly placeholder for null (price not set).
 */
export function formatPriceFromCents(priceInCents: number | null): string {
  if (priceInCents === null) return "Não informado"
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    priceInCents / 100
  )
}
