import "server-only"
import { headers } from "next/headers"

import { resolveHostTenant } from "@/lib/tenant/tenant-url"
import { resolveAppEnv } from "@/lib/env/env-readiness"
import { parseSubdomainEnforced } from "@/lib/tenant/tenant-security"
import type { TenantResolution } from "@/lib/platform/tenant-resolver"

/**
 * Server-side glue for tenant resolution (Prompt 27). Reads the request host
 * from headers and turns it into a tenant resolution + a couple of small env
 * accessors. The DECISION logic lives in lib/tenant/tenant-security.ts (pure,
 * unit-tested); this file only supplies the runtime host/env inputs.
 */

/** Best-effort request host: honor a reverse proxy's forwarded host first. */
export function pickRequestHost(h: Headers): string | null {
  return h.get("x-forwarded-host") ?? h.get("host")
}

/** The current request host (server components / route handlers). */
export async function getRequestHost(): Promise<string | null> {
  const h = await headers()
  return pickRequestHost(h)
}

/** Resolve the tenant for the current request (server components / route handlers). */
export async function getHostTenant(): Promise<TenantResolution> {
  return resolveHostTenant(await getRequestHost())
}

/** Resolve the tenant from an incoming Request (route handlers). */
export function getHostTenantFromRequest(request: Request): TenantResolution {
  return resolveHostTenant(pickRequestHost(request.headers))
}

/** Master switch for hard subdomain enforcement (root-login block). Default OFF. */
export function isSubdomainEnforced(): boolean {
  return parseSubdomainEnforced(process.env.TENANT_SUBDOMAIN_ENFORCED)
}

/** Convenience re-export so callers can pass the resolved env to pure helpers. */
export { resolveAppEnv }
