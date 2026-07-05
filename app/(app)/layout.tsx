import { redirect } from "next/navigation"

import { getCurrentUser, getCurrentUserClinic, getSessionClinicStatus } from "@/lib/current-user"
import { evaluateClinicAccess } from "@/lib/platform/clinic-access"
import { getHostTenant } from "@/lib/tenant/tenant-context"
import { evaluateTenantSessionBinding } from "@/lib/tenant/tenant-security"
import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"
import { AppShell } from "@/components/layout/app-shell"
import { ClinicBlockedScreen } from "@/components/layout/clinic-blocked-screen"

// Every authenticated route is per-request (auth cookie + tenant data). Force
// dynamic so `next build` never tries to prerender them — this keeps the build
// from querying the database at build time (safe on Vercel; no DB coupling).
export const dynamic = "force-dynamic"

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Commercial suspension guard (Prompt 21): a valid, active user whose CLINIC
  // is SUSPENDED/INACTIVE gets a clear block screen instead of being bounced to
  // /login (getCurrentUser would return null for a non-ACTIVE clinic). This
  // blocks ONLY this clinic — other clinics are unaffected.
  const access = await getSessionClinicStatus()
  if (access?.userActive) {
    const clinicAccess = evaluateClinicAccess(access.clinicStatus)
    if (clinicAccess.blocked) {
      return <ClinicBlockedScreen reason={clinicAccess.reason ?? "suspended"} />
    }
  }

  // Authoritative, database-backed checks. The Proxy (proxy.ts) already did
  // an optimistic cookie check before this layout even runs, but the
  // temporaryPassword redirect specifically requires a DB read, which Proxy
  // intentionally avoids for performance — see docs/authentication.md.
  const user = await getCurrentUser()

  if (!user) {
    // Not just "/login": the cookie may still be signature-valid (e.g. after
    // a local db:seed recreated users with new ids) even though it no
    // longer maps to a real account. Redirecting straight to /login would
    // leave that stale cookie in place, and Proxy's optimistic check would
    // immediately bounce back to /dashboard — an infinite redirect loop.
    // This route clears the cookie first, then redirects to /login for real.
    redirect("/api/auth/clear-session")
  }

  if (user.temporaryPassword) {
    redirect("/alterar-senha")
  }

  const clinic = await getCurrentUserClinic()

  // Tenant session↔host binding (Prompt 27): when this request came in on a
  // CLINIC subdomain, the logged-in user's own clinic (authoritative, from the
  // DB) must match it. A clinic-A session used on clinic-B's host is denied and
  // the session is cleared. At the root/app host (or local dev) there is no
  // tenant to bind against, so nothing changes — this keeps HML working before
  // wildcard DNS is live. See docs/domains-and-dns.md.
  const hostTenant = await getHostTenant()
  const binding = evaluateTenantSessionBinding({
    hostKind: hostTenant.kind,
    hostSlug: hostTenant.slug,
    sessionSlug: clinic?.slug ?? null,
  })
  if (binding.action === "deny") {
    await createAuditLog({
      clinicId: user.clinicId,
      userId: user.id,
      action: AuditAction.TENANT_SESSION_MISMATCH,
      entity: "User",
      entityId: user.id,
      description: "Sessão de clínica usada em um endereço de outra clínica — acesso negado.",
      metadata: { sessionSlug: clinic?.slug ?? null, hostSlug: hostTenant.slug ?? null },
    })
    redirect("/api/auth/clear-session")
  }

  return (
    <AppShell user={{ name: user.name, role: user.role }} clinicName={clinic?.name ?? null}>
      {children}
    </AppShell>
  )
}
