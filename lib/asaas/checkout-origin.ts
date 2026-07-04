import type { AppEnv } from "@/lib/env/env-readiness"

/**
 * Origin protection for the public checkout endpoint (pure — unit-testable).
 *
 *  - No Origin header (server-to-server / curl) → allowed (Origin is only sent
 *    by browsers on cross-origin requests; this endpoint is meant to be called
 *    by the marketing site's frontend or server).
 *  - Allowed list configured → the Origin must be in it.
 *  - No list configured → only allowed in local dev (blocked in staging/prod).
 */
export function isCheckoutOriginAllowed(
  origin: string | null | undefined,
  allowedOriginsCsv: string,
  appEnv: AppEnv
): boolean {
  const allowed = allowedOriginsCsv
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean)

  if (!origin) return true // non-browser caller
  const normalized = origin.trim().replace(/\/$/, "")

  if (allowed.length === 0) return appEnv === "local"
  return allowed.includes(normalized)
}
