/**
 * Environment-aware tenant URL generation (Prompt 25). PURE — no DB, no secrets.
 *
 * The clinic access URL is derived from APP_URL (the env-specific base), so it is
 * automatically correct per environment WITHOUT hardcoding a domain:
 *   - staging  APP_URL=https://hml.app.sinery.com.br → https://{slug}.hml.app.sinery.com.br
 *   - prod     APP_URL=https://app.sinery.com.br     → https://{slug}.app.sinery.com.br
 *   - local    APP_URL=http://localhost:3000         → http://localhost:3000 (no subdomain)
 *
 * Local returns the base URL (no `{slug}.localhost`) — the least risky option,
 * since wildcard localhost needs host/DNS support that isn't guaranteed.
 * Reserved/invalid slugs never produce a tenant URL (they return the base app URL).
 */
import { RESERVED_SLUGS } from "@/lib/platform/slug"
import { resolveTenantFromHost, type TenantResolution } from "@/lib/platform/tenant-resolver"

const SLUG_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/

function envAppBaseUrl(): string {
  return (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").trim() || "http://localhost:3000"
}

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".localhost")
}

/** The base app origin (protocol + host + port), with a leading `www.` stripped. */
export function appBaseUrl(appUrl?: string): string {
  const base = (appUrl ?? envAppBaseUrl()).trim() || "http://localhost:3000"
  let url: URL
  try {
    url = new URL(base)
  } catch {
    return base.replace(/\/+$/, "")
  }
  const host = url.hostname.replace(/^www\./, "")
  const port = url.port ? `:${url.port}` : ""
  return `${url.protocol}//${host}${port}`
}

/**
 * Builds the access URL for a clinic `slug` in the current (or given) environment.
 * Reserved/invalid slug → the base app URL (never a tenant URL). Local → base URL.
 */
export function buildTenantUrl(slug: string, appUrl?: string): string {
  const base = (appUrl ?? envAppBaseUrl()).trim() || "http://localhost:3000"
  let url: URL
  try {
    url = new URL(base)
  } catch {
    return base.replace(/\/+$/, "")
  }

  const s = (slug ?? "").trim().toLowerCase()
  const hostname = url.hostname.replace(/^www\./, "")
  const port = url.port ? `:${url.port}` : ""
  const origin = `${url.protocol}//${hostname}${port}`

  // Invalid or reserved slug → base app URL (safe; never a tenant subdomain).
  if (!s || !SLUG_RE.test(s) || RESERVED_SLUGS.has(s)) return origin
  // Local: no subdomain (less risky). Return the base app URL.
  if (isLocalHost(hostname)) return origin

  return `${url.protocol}//${s}.${hostname}${port}`
}

/**
 * Derives the "app prefix" — the subdomain labels between a tenant slug and the
 * root domain (e.g. "app" in prod, "hml.app" in staging) — from APP_URL + the
 * root domain. Used by the tenant host resolver so `{slug}.hml.app.<root>` works.
 */
export function deriveAppPrefix(appUrl: string, rootDomain: string): string {
  const root = (rootDomain ?? "").trim().toLowerCase()
  try {
    const host = new URL(appUrl).hostname.replace(/^www\./, "")
    if (root && host.endsWith(`.${root}`)) return host.slice(0, host.length - root.length - 1)
    if (root && host === root) return "app"
    return "app"
  } catch {
    return "app"
  }
}

/** Resolve options for `resolveTenantFromHost`, derived from the current env. */
export function getTenantResolveOptions(): { rootDomain: string; appPrefix: string; defaultSlug: string } {
  const rootDomain = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "").trim().toLowerCase()
  const appUrl = envAppBaseUrl()
  return {
    rootDomain,
    appPrefix: deriveAppPrefix(appUrl, rootDomain),
    defaultSlug: (process.env.DEFAULT_TENANT_SLUG ?? "sorria-odonto").trim() || "sorria-odonto",
  }
}

/**
 * Resolve the tenant from a request host using the current environment's
 * options. PURE (no DB) — usable from the Proxy (edge), route handlers, server
 * components, and tests. Prefer this single entry point everywhere so host
 * parsing behaves identically across the app.
 */
export function resolveHostTenant(host: string | null | undefined): TenantResolution {
  return resolveTenantFromHost(host, getTenantResolveOptions())
}
