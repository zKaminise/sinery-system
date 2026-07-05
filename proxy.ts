import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { decryptSession, getSessionCookieName } from "@/lib/session"
import { decryptPlatformSession, getPlatformCookieName } from "@/lib/platform/platform-session"
import { resolveHostTenant, appBaseUrl } from "@/lib/tenant/tenant-url"
import { evaluateFounderHostAccess } from "@/lib/tenant/tenant-security"

// Starting with Next.js 16, "Middleware" is called "Proxy" — this file
// replaces what used to be middleware.ts. See node_modules/next/dist/docs.

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/agenda",
  "/pacientes",
  "/conversas",
  "/profissionais",
  "/servicos",
  "/assist",
  "/auditoria",
  "/status",
  "/configuracoes",
  "/alterar-senha",
]

const PUBLIC_ROUTES = ["/login"]

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

/**
 * Optimistic auth check only: verifies the session cookie's signature and
 * expiration, without hitting the database. This is intentional — Proxy
 * runs on every request (including prefetches) and should stay fast. The
 * authoritative check (user/clinic still ACTIVE, temporaryPassword forcing
 * /alterar-senha) happens in app/(app)/layout.tsx via getCurrentUser(),
 * which does query the database. See docs/authentication.md.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const hostTenant = resolveHostTenant(
    request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  )

  // Founder / platform area — uses a SEPARATE cookie from the clinic session.
  // A clinic user (clinic cookie only) never passes this, and a platform user
  // never reaches the clinic area (they lack a clinic cookie).
  if (pathname === "/founder" || pathname.startsWith("/founder/")) {
    // The Founder area is ROOT-only. On a clinic subdomain, bounce back to the
    // root app host so the platform admin is never served from a clinic domain.
    if (evaluateFounderHostAccess(hostTenant.kind).action === "redirect_root") {
      return NextResponse.redirect(new URL("/founder/login", appBaseUrl()))
    }
    const platformToken = request.cookies.get(getPlatformCookieName())?.value
    const platformSession = await decryptPlatformSession(platformToken)
    if (pathname === "/founder/login") {
      if (platformSession) return NextResponse.redirect(new URL("/founder", request.url))
      return NextResponse.next()
    }
    if (!platformSession) {
      return NextResponse.redirect(new URL("/founder/login", request.url))
    }
    return NextResponse.next()
  }

  const token = request.cookies.get(getSessionCookieName())?.value
  const session = await decryptSession(token)

  if (isProtectedPath(pathname) && !session) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("from", pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (PUBLIC_ROUTES.includes(pathname) && session) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
}
