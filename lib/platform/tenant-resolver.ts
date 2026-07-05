/**
 * Host → tenant resolution (pure — unit-testable). Prepares the app for
 * subdomain-based multi-tenancy without requiring DNS to be configured yet.
 *
 * Strategy (documented in docs/founder-admin.md):
 *   - localhost / 127.0.0.1        → default tenant (DEFAULT_TENANT_SLUG)
 *   - <root>, www.<root>           → marketing site
 *   - app.<root>                   → general login (no clinic)
 *   - {slug}.app.<root>            → clinic by slug
 *   - {slug}.<root>                → clinic by slug (alt strategy)
 *   - reserved slug                → NOT a clinic (falls back to app)
 * /founder routes never depend on the tenant (resolved by route, not host).
 */

import { RESERVED_SLUGS } from "@/lib/platform/slug"

export type TenantKind = "default" | "clinic" | "app" | "marketing"

export interface TenantResolution {
  kind: TenantKind
  slug?: string
}

export interface ResolveTenantOptions {
  /** Root marketing/app domain, e.g. "sinere.com.br". */
  rootDomain?: string
  /** Slug used for localhost/dev. */
  defaultSlug?: string
  /**
   * Subdomain labels between a tenant slug and the root domain: "app" in
   * production, "hml.app" in HML/staging. Defaults to "app". Derived from
   * APP_URL by `getTenantResolveOptions()` (lib/tenant/tenant-url.ts).
   */
  appPrefix?: string
}

function stripPort(host: string): string {
  return host.trim().toLowerCase().split(":")[0]
}

export function resolveTenantFromHost(
  host: string | null | undefined,
  options: ResolveTenantOptions = {}
): TenantResolution {
  const defaultSlug = options.defaultSlug ?? "sorria-odonto"
  const rootDomain = (options.rootDomain ?? "").trim().toLowerCase()
  const appPrefix = (options.appPrefix ?? "app").trim().toLowerCase() || "app"

  if (!host) return { kind: "default", slug: defaultSlug }

  const hostname = stripPort(host)

  // Local development: always the default tenant.
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".localhost")) {
    return { kind: "default", slug: defaultSlug }
  }

  // Without a configured root domain we can't parse subdomains → default.
  if (!rootDomain) return { kind: "default", slug: defaultSlug }

  // Exact marketing domain.
  if (hostname === rootDomain || hostname === `www.${rootDomain}`) {
    return { kind: "marketing" }
  }

  // Must be a subdomain of the root to resolve further.
  if (!hostname.endsWith(`.${rootDomain}`)) {
    return { kind: "default", slug: defaultSlug }
  }

  const prefix = hostname.slice(0, hostname.length - rootDomain.length - 1) // drop ".root"

  // <appPrefix>.<root> → general login (e.g. "app" prod, "hml.app" staging).
  if (prefix === appPrefix) return { kind: "app" }

  // {slug}.<appPrefix>.<root> → clinic. The slug must be a single label.
  if (prefix.endsWith(`.${appPrefix}`)) {
    const slug = prefix.slice(0, prefix.length - appPrefix.length - 1)
    if (!slug.includes(".")) return slugToResolution(slug)
    return { kind: "app" } // deeper unknown subdomain
  }

  // {slug}.<root> (single-label subdomain) → clinic.
  if (!prefix.includes(".")) {
    return slugToResolution(prefix)
  }

  // Unknown deeper subdomain → app.
  return { kind: "app" }
}

function slugToResolution(slug: string): TenantResolution {
  if (!slug || RESERVED_SLUGS.has(slug)) return { kind: "app" }
  return { kind: "clinic", slug }
}
