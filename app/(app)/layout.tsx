import { redirect } from "next/navigation"

import { getCurrentUser, getCurrentUserClinic } from "@/lib/current-user"
import { AppShell } from "@/components/layout/app-shell"

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
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

  return (
    <AppShell user={{ name: user.name, role: user.role }} clinicName={clinic?.name ?? null}>
      {children}
    </AppShell>
  )
}
