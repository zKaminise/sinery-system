import { headers } from "next/headers"

import { prisma } from "@/lib/prisma"
import { getCurrentUserClinic } from "@/lib/current-user"
import { isDynamicServerUsageError } from "@/lib/utils"
import { resolveHostTenant } from "@/lib/tenant/tenant-url"
import { resolveAppEnv } from "@/lib/env/env-readiness"
import { shouldUseDefaultTenant } from "@/lib/tenant/tenant-security"
import type { Clinic } from "@/lib/generated/prisma/client"

/**
 * Fallback slug used to resolve "the current clinic" when there is no logged-in
 * user. DEFAULT_TENANT_SLUG is a LOCAL/DEV convenience ONLY (Prompt 27): in
 * staging/production the root domain must never silently resolve to a default
 * clinic — an unauthenticated request there simply has no clinic (returns null).
 */
export function getDefaultTenantSlug(): string | null {
  if (!shouldUseDefaultTenant(resolveAppEnv())) return null
  return process.env.DEFAULT_TENANT_SLUG || "sorria-odonto"
}

/** Host → clinic slug for the unauthenticated fallback (null at the root/app host). */
function slugFromHost(host: string | null | undefined): string | null {
  const resolved = resolveHostTenant(host)
  return resolved.kind === "clinic" && resolved.slug ? resolved.slug : null
}

export async function getClinicBySlug(slug: string): Promise<Clinic | null> {
  return prisma.clinic.findUnique({ where: { slug } })
}

/**
 * Extracts the tenant subdomain from a request host, given the app's root
 * domain (e.g. host "sorria-odonto.sinery.com.br" with root domain
 * "sinery.com.br" resolves to "sorria-odonto"). Returns null for the root
 * domain itself, localhost, or IP hosts — callers should fall back to
 * `getDefaultTenantSlug()` in those cases.
 */
export function extractSubdomainFromHost(
  host: string | null | undefined,
  rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000"
): string | null {
  if (!host) return null

  const cleanHost = host.split(":")[0]
  const cleanRoot = rootDomain.split(":")[0]

  if (cleanHost === cleanRoot || cleanHost === "localhost" || cleanHost === "127.0.0.1") {
    return null
  }

  if (!cleanHost.endsWith(`.${cleanRoot}`)) {
    return null
  }

  const subdomain = cleanHost.slice(0, -`.${cleanRoot}`.length)
  if (!subdomain || subdomain === "www") return null

  return subdomain
}

/**
 * Resolves the clinic for the current request. The logged-in user's own
 * clinic (from the session) is the primary source of truth. When there's no
 * authenticated user — e.g. dev tooling hitting a route before login exists
 * — this falls back to the host-derived subdomain, then to
 * DEFAULT_TENANT_SLUG, exactly as it did before real authentication existed.
 */
export async function getCurrentClinic(): Promise<Clinic | null> {
  const userClinic = await getCurrentUserClinic()
  if (userClinic) return userClinic

  const headersList = await headers()
  const host = headersList.get("host")
  const slug = slugFromHost(host) ?? getDefaultTenantSlug()
  if (!slug) return null

  return getClinicBySlug(slug)
}

/**
 * Same as `getCurrentClinic`, but only catches database errors — not
 * Next.js's internal "dynamic rendering" signal thrown by `headers()`
 * during a static-generation attempt, which must be allowed to propagate.
 * Use this from pages/components that want a graceful fallback UI instead
 * of a thrown error when the database is unreachable.
 */
export async function getCurrentClinicSafe(): Promise<{
  clinic: Clinic | null
  dbError: boolean
}> {
  try {
    const userClinic = await getCurrentUserClinic()
    if (userClinic) return { clinic: userClinic, dbError: false }
  } catch (error) {
    if (isDynamicServerUsageError(error)) throw error
    console.error("[getCurrentClinicSafe] session-based lookup failed:", error)
    return { clinic: null, dbError: true }
  }

  const headersList = await headers()
  const host = headersList.get("host")
  const slug = slugFromHost(host) ?? getDefaultTenantSlug()
  if (!slug) return { clinic: null, dbError: false }

  try {
    const clinic = await getClinicBySlug(slug)
    return { clinic, dbError: false }
  } catch (error) {
    console.error("[getCurrentClinicSafe] database lookup failed:", error)
    return { clinic: null, dbError: true }
  }
}
