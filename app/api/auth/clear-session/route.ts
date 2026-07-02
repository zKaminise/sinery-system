import { NextResponse } from "next/server"

import { clearSessionCookie } from "@/lib/session"

/**
 * Clears the session cookie and redirects to /login. Used as the redirect
 * target whenever a database-backed check finds the session's JWT is
 * signature-valid but no longer maps to a usable account — e.g. the user/
 * clinic was deactivated, or (in local dev) the database was reseeded and
 * the old userId no longer exists.
 *
 * This exists because Server Components (like app/(app)/layout.tsx and
 * app/alterar-senha/page.tsx) cannot mutate cookies during render — only
 * Route Handlers and Server Actions can. Without this, redirecting straight
 * to /login would leave the stale-but-signature-valid cookie in place, and
 * Proxy's optimistic check (cookie decodes fine) would immediately bounce
 * the request back to /dashboard, creating a /login <-> /dashboard loop.
 */
export async function GET(request: Request) {
  await clearSessionCookie()
  return NextResponse.redirect(new URL("/login", request.url))
}
