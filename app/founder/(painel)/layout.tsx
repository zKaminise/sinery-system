import { redirect } from "next/navigation"

import { getCurrentPlatformUser } from "@/lib/platform/current-platform-user"
import { FounderShell } from "@/components/founder/founder-shell"

// The founder panel is per-request (platform-session guarded). Force dynamic so
// `next build` never prerenders it — no database queries at build time.
export const dynamic = "force-dynamic"

/**
 * Authoritative guard for the founder panel. A clinic user never has a platform
 * session, so they can never pass this check. A stale platform cookie (user
 * removed) is cleared to avoid a redirect loop.
 */
export default async function FounderPanelLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentPlatformUser()
  if (!user) redirect("/api/founder/auth/clear-session")
  if (user.temporaryPassword) redirect("/founder/alterar-senha")

  return <FounderShell user={{ name: user.name, role: user.role }}>{children}</FounderShell>
}
