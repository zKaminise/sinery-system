/**
 * Multi-tenant subdomain SECURITY decisions (Prompt 27). PURE — no DB, no
 * secrets, no `server-only`, so it runs in the Proxy (edge), route handlers,
 * server components, and unit tests alike.
 *
 * Threat model these functions encode:
 *   - A clinic-A user must NOT be able to log into clinic-B's subdomain, even
 *     with the correct password → login is scoped to the host-resolved clinic.
 *   - A session minted for clinic A must NOT be usable on clinic B's host →
 *     session↔host binding denies the mismatch (audited as TENANT_SESSION_MISMATCH).
 *   - In staging/production the ROOT host (app/marketing) must NOT log clinic
 *     users in — they must use their clinic subdomain. Gated behind
 *     TENANT_SUBDOMAIN_ENFORCED so HML keeps working until wildcard DNS is live.
 *   - The Founder/Platform area is ROOT-only; on a clinic subdomain it bounces
 *     back to the root.
 *   - DEFAULT_TENANT_SLUG is a LOCAL/DEV convenience only — the root domain must
 *     never silently resolve to a default clinic in staging/production.
 */
import type { AppEnv } from "@/lib/env/env-readiness"
import type { TenantKind, TenantResolution } from "@/lib/platform/tenant-resolver"

/** Master switch for hard subdomain enforcement (root-block). Default OFF. */
export function parseSubdomainEnforced(raw: string | undefined): boolean {
  return (raw ?? "").trim().toLowerCase() === "true"
}

/** A "root" host is the app login host or the marketing site — never a clinic. */
export function isRootHostKind(kind: TenantKind): boolean {
  return kind === "app" || kind === "marketing" || kind === "default"
}

export interface RootLoginAccess {
  blocked: boolean
  reason: "root_login_requires_subdomain" | null
}

/**
 * Whether clinic login must be BLOCKED at the current host. Only blocks when
 * enforcement is ON, the environment is staging/production, and the host is the
 * root (app/marketing). Local dev and clinic subdomains are never blocked.
 * `default` (localhost) is treated as root but is excluded via the appEnv check.
 */
export function evaluateRootLoginAccess(input: {
  appEnv: AppEnv
  hostKind: TenantKind
  enforced: boolean
}): RootLoginAccess {
  const rootLike = input.hostKind === "app" || input.hostKind === "marketing"
  if (input.enforced && input.appEnv !== "local" && rootLike) {
    return { blocked: true, reason: "root_login_requires_subdomain" }
  }
  return { blocked: false, reason: null }
}

/**
 * The clinic slug the login lookup MUST be scoped to. Returns the slug only when
 * the host resolves to a specific clinic; otherwise null (email-only fallback,
 * used at the root host and in local dev). This is what makes a clinic-A user
 * fail to authenticate on clinic-B's subdomain.
 */
export function resolveLoginClinicScope(host: TenantResolution): string | null {
  return host.kind === "clinic" && host.slug ? host.slug : null
}

export interface TenantSessionBinding {
  action: "allow" | "deny"
  reason: "tenant_session_mismatch" | null
}

/**
 * A session is valid on a host only if it belongs to the clinic that the host
 * resolves to. Binding is enforced ONLY when the host IS a clinic — at the root
 * host there is no tenant to bind against, so any valid session is allowed
 * through (that is what keeps the root login/dashboard working before wildcard
 * DNS exists). A missing session slug (older cookie) can't prove a mismatch, so
 * it is allowed here; the caller re-validates authoritatively against the DB.
 */
export function evaluateTenantSessionBinding(input: {
  hostKind: TenantKind
  hostSlug?: string | null
  sessionSlug?: string | null
}): TenantSessionBinding {
  if (input.hostKind !== "clinic" || !input.hostSlug) {
    return { action: "allow", reason: null }
  }
  if (!input.sessionSlug) {
    return { action: "allow", reason: null }
  }
  if (input.sessionSlug !== input.hostSlug) {
    return { action: "deny", reason: "tenant_session_mismatch" }
  }
  return { action: "allow", reason: null }
}

/**
 * The Founder/Platform area lives at the ROOT only. On a clinic subdomain it
 * must be redirected back to the root — a clinic host must never serve the
 * platform admin. Non-clinic hosts (app/marketing/default) are allowed.
 */
export function evaluateFounderHostAccess(hostKind: TenantKind): {
  action: "allow" | "redirect_root"
} {
  return hostKind === "clinic" ? { action: "redirect_root" } : { action: "allow" }
}

/** DEFAULT_TENANT_SLUG may only resolve a clinic in local/dev — never staging/prod. */
export function shouldUseDefaultTenant(appEnv: AppEnv): boolean {
  return appEnv === "local"
}

/** Generic, existence-hiding login errors (never reveal whether user/clinic exist). */
export const LOGIN_ERROR_GENERIC = "E-mail ou senha inválidos."
export const LOGIN_ERROR_TENANT =
  "E-mail ou senha inválidos, ou endereço da clínica incorreto."
export const ROOT_LOGIN_REQUIRES_SUBDOMAIN_MESSAGE =
  "Acesse o sistema pelo endereço da sua clínica (por exemplo, https://sua-clinica.hml.app.sinery.com.br)."

/** The generic error to show for a login attempt on the given host resolution. */
export function loginErrorFor(host: TenantResolution | null | undefined): string {
  return host && resolveLoginClinicScope(host) ? LOGIN_ERROR_TENANT : LOGIN_ERROR_GENERIC
}
